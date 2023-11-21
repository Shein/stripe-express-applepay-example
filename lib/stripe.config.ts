import { FieldOption } from '@stripe/stripe-js';

export type StripeElementMode = 'payment' | 'setup' | 'subscription' | undefined;

export type StripeElementExpressOptionsApplyPayTheme = 'dark' | 'light' | 'light-outline';

export const StripePaymentElementOptions = {
    fields: {
        billingDetails: 'never' as FieldOption
    }
};

export const StripeAppearance = {
    variables: {
        fontFamily: 'ApercuPro, system-ui, sans-serif',
        fontWeightNormal: '400',
        borderRadius: '6px',
        colorBackground: '#fcf4ec',
        colorPrimary: '#fcf4ec',
        colorPrimaryText: '#FF0000',
        colorText: '#253755',
        colorTextSecondary: '#253755',
        colorTextPlaceholder: '#727F96',
        colorIconTab: 'black',
        colorIconTabSelected: '#253755'
    },
    rules: {
        '.Input, .Block': {
            backgroundColor: '#fcf4ec',
            border: '1.5px solid var(--colorPrimary)'
        },
        '.Label': {
            opacity: '0'
        },
        '.Tab--selected': {
            color: 'red'
        },
        '.TabLabel': {
            color: '#253755'
        }
    }
};
