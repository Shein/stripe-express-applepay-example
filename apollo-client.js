import { ApolloClient, InMemoryCache, concat, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const httpLink = createHttpLink({
    uri: process.env.NEXT_PUBLIC_API_URL
});

const authLink = setContext(async (request, previousContext) => {
    let headers = {};
    let token;
    if (typeof window !== 'undefined' && localStorage) {
        token = JSON.parse(localStorage.getItem('kaitenUser'))?.state?.token;
    } else {
        const { cookies } = await import('next/headers');
        const contextCookies = cookies();
        const tokenCookie = contextCookies.get('token');
        if (tokenCookie) {
            const { value } = tokenCookie;
            if (value) {
                token = value;
            }
        }
    }

    if (token) {
        headers = { ...previousContext.headers, authorization: token };
    }

    // return the headers to the context so httpLink can read them
    return {
        headers
    };
});

const client = new ApolloClient({
    link: concat(authLink, from([httpLink])),
    cache: new InMemoryCache(),
    defaultOptions: {
        query: {
            fetchPolicy: 'network-only'
        },
        mutate: {
            fetchPolicy: 'no-cache'
        }
    }
});

export default client;
