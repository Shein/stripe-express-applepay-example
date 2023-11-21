'use client'

import { StripeAppearance, StripeElementMode } from "@/lib/stripe.config";
import { Elements, ExpressCheckoutElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { ApplePayButtonTheme, ApplePayButtonType, ClickResolveDetails, GooglePayButtonType, LineItem, ShippingRate, StripeExpressCheckoutElementConfirmEvent, StripeExpressCheckoutElementShippingAddressChangeEvent, loadStripe } from "@stripe/stripe-js";
import { useState } from "react";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_TOKEN!);

interface CreatedOrderShippingOption {
    cost: number;
    name: string;
}

const items = [{name: 'Some Cake', amount: 1000}, {name: 'Some Wine', amount: 2500}, { name: 'Service Fee', amount: 500 }]
const updatedShippingOptions = [{name: "Standard", cost: 1000},{ name: "Express", cost: 2500}, {name: "PickUp", cost: 0}]

const ExpressCheckout = () => {

    const options = {
        mode: 'payment' as StripeElementMode,
        amount: items.reduce((acc, item) => acc + item.amount, 0),
        currency: 'usd',
        appearance: StripeAppearance
    };

    return (
        <Elements options={options} stripe={stripePromise}>
            <ExpressCheckoutButtons />
        </Elements>
    )
}

const ExpressCheckoutButtons = () => {
    // Stripe hooks
    const stripe = useStripe();
    const elements = useElements();

    // State to track if we have any express checkout options to show to update UI
    const [hasExpressCheckoutOptions, setHasExpressCheckoutOptions] = useState(true);

    // User initiated an express checkout, so we create the payment details for it
    const onClick = ({ resolve }: { resolve: (_resolveDetails?: ClickResolveDetails) => void }) => {
        const paymentDetailsReady = paymentDetails([], true);
        resolve(paymentDetailsReady);
    };

    // Construct payment details with the context we have
    // This is called when we first launch the payment flow (onClick of ExpressCheckoutElement)
    // and after every update to shipping address (onShippingAddressChange)
    const paymentDetails = (
        shippingOptions: CreatedOrderShippingOption[],
        initialSetup: boolean = false
    ) => {
        let shippingRates: ShippingRate[] = [];
        if ((shippingOptions?.length || 0) > 0) {
            // If we have shipping options for the current address, iterate through them
            // and create the shipping rates
            shippingRates = shippingOptions?.map((option, index) => {
                return {
                    id: `${index}`,
                    amount: option.cost || 0,
                    displayName: option.name || ''
                };
            });
        } else if (initialSetup) {
            // WORKAROUND: because Stripe throws an error when not given shippingRates (undefine/null/[])
            // we MUST provide some DUMMY data when onClick is fired, otherwise we get an exception:
            // IntegrationError: When `shippingAddressRequired` is true, you must specify `shippingRates`.
            // but if we set shippingAddressRequired to `false` there is no option to set a shippign address

            // DEAR STRIPE:
            //
            // Uncomment the code below to enable the workaround and remove the error

            // shippingRates = [
            //     {
            //         id: 'standard',
            //         amount: 0,
            //         displayName: 'Calculating shipping...'
            //     }
            // ];
        }

        // Construct the line items
        const lineItems: LineItem[] = items

        // DEAR STRIPE: 
        //
        // Passing shippingRates as empty array ([]) or null here produces and ERROR if shippingAddressRequired is true
        // so users must first be shown a shipping option that is not relevant to their shipping address, because we 
        // have to provide some shipping option even before we get the users shipping address.
        //
        // We need to be able to pass an empty array for shipping rates, and have the Apple Pay sheet not show shipping 
        // options until an address has been inserted
        // 
        // Thank you as always
        // Team Kaiten
        const options = {
            shippingRates,
            lineItems,
            business: { name: 'Kaiten' },
            emailRequired: true,
            phoneNumberRequired: true,
            shippingAddressRequired: true
        };

        return options;
    };

    // Handle updates to use selecting shipping address
    const onShippingAddressChange = async (
        event: StripeExpressCheckoutElementShippingAddressChangeEvent
    ) => {
        const { address } = event;
        try {
            const { city, state, postal_code: zipcode, country } = address;
            const orderAddress = { line1: '', city, state, zipcode, country };
            // Send our server the updated order and address details to get shipping options
            // const updatedOrders: CreatedOrder = await createOrUpdateOrders(...);

            // Create updated payment options with new shipping options
            const paymentDetailsReady = paymentDetails(updatedShippingOptions ?? []);
            if (
                paymentDetailsReady.shippingAddressRequired &&
                (paymentDetailsReady.shippingRates?.length || 0) > 0
            ) {
                event.resolve(paymentDetailsReady);
            } else {
                event.reject();
            }
        } catch (error) {
            event.resolve();
        }
    };

    const onReady = ({ availablePaymentMethods }: { availablePaymentMethods: any }) => {
        console.log(`±±±± ON READY ${JSON.stringify(availablePaymentMethods)}`);
        if (!availablePaymentMethods) {
            // No buttons will show
            setHasExpressCheckoutOptions(false);
        } else {
            // Optional: Animate in the Element
            // setVisibility('initial');
        }
    };

    const onCancel = (event: { elementType: 'expressCheckout' }) => {
        console.log('Cancelled express checkout');
    };

    const onConfirm = async (event: StripeExpressCheckoutElementConfirmEvent) => {
        console.log(`~~~~~Event ${JSON.stringify(event)}`);

        // billingDetails?: BillingDetails;
        // shippingAddress?: ShippingAddress;
        // shippingRate?: ShippingRate;
        // expressPaymentType: ExpressPaymentType;

        if (!stripe || !elements) {
            // Stripe.js hasn't yet loaded.
            // Make sure to disable form submission until Stripe.js has loaded.
            // TODO: show error
            return;
        }

        const clientSecret = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_INTENT_SECRET
        if (!clientSecret) {
            // TODO: show error
            return;
        }

        const { billingDetails, shippingAddress, shippingRate, expressPaymentType } = event;
        if (!billingDetails) {
            // TODO: handle error
            return;
        }

        const { email, phone, name, address } = event.billingDetails!;
        const { line1, line2, city, state, country, postal_code } = address;
        const billing_details = {
            email,
            phone,
            name,
            address: { country, city, state, line1, line2: line2 ?? undefined, postal_code }
        };

        // TODO: post to update backend

        const { error } = await stripe.confirmPayment({
            clientSecret,
            elements,
            confirmParams: {
                return_url: `${window.location.href}/confirmation`,
                payment_method_data: {
                    billing_details
                }
            }
        });

        if (error) {
            // This point will only be reached if there is an immediate error when
            // confirming the payment. Otherwise, your customer will be redirected to
            // your `return_url`. For some payment methods like iDEAL, your customer will
            // be redirected to an intermediate site first to authorize the payment, then
            // redirected to the `return_url`.
            if (error.type === 'card_error' || error.type === 'validation_error') {
                console.error(error.message);
            } else {
                console.error('An unexpected error occurred.');
            }
        } else {
            // clearCart();
        }
    };

    const options = {
        // layout: 'auto',
        buttonType: {
            googlePay: 'order' as GooglePayButtonType,
            applePay: 'order' as ApplePayButtonType,
            paypal: 'buynow'
        },
        buttonTheme: {
            applePay: 'black' as ApplePayButtonTheme
        },
        buttonHeight: 55
    };

    if (hasExpressCheckoutOptions) {
        return (
            <section className="flex flex-col space-y-4 px-4 xl:px-14 2xl:px-0 text-black">
                <h3 className="font-sans text-lg  ">Express Checkout</h3>
                <ExpressCheckoutElement
                    {...{ options, onConfirm, onClick, onCancel, onReady, onShippingAddressChange }}
                />

            </section>
        );
    } else {
        return <></>;
    }
};

export default ExpressCheckout;