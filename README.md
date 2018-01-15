# Stripe subscriptions via Webtask.io

Helper to set up one-off Stripe subscriptions using [Webtask.io](https://webtask.io).

## Pre-requisites

```
# Install the Webtask CLI
npm install -g wt-cli

# Create a Webtask profile
wt init
```

## Set-up

1. Copy `.secrets.example` to `.secrets` and enter your Stripe [public and secret keys](https://dashboard.stripe.com/account/apikeys), as well as your vendor name and email address.
2. Create a [Plan](https://dashboard.stripe.com/plans/) in your Stripe dashboard.
3. Create the Webtask that will help set up the subscription: `npm run setup`.
4. Direct your customer(s) to the resulting url with `/:planId` appended.
5. ...
6. Profit?
