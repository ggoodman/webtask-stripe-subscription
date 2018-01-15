'use strict';

const Assert = require('assert');
const Async = require('async');
const Ejs = require('ejs');
const Express = require('express');
const Stripe = require('stripe');
const Webtask = require('webtask-tools');

Assert.ok(module.webtask && module.webtask.secrets && module.webtask.secrets.STRIPE_SECRET_KEY, 'Stripe secret key is required');
Assert.ok(module.webtask && module.webtask.secrets && module.webtask.secrets.STRIPE_PUBLIC_KEY, 'Stripe public key is required');
Assert.ok(module.webtask && module.webtask.secrets && module.webtask.secrets.VENDOR_EMAIL, 'Vendor email is required');
Assert.ok(module.webtask && module.webtask.secrets && module.webtask.secrets.VENDOR_NAME, 'Vendor name is required');

const app = Express();
const stripe = Stripe(module.webtask.secrets.STRIPE_SECRET_KEY);

app.use(require('body-parser').urlencoded({
    extended: false,
}));

app.get('/:planId', (req, res, next) => {
    return Async.autoInject({
        planId: (cb) => cb(null, req.params.planId),
        plan: (planId, cb) => stripe.plans.retrieve(planId, cb),
    }, (error, results) => {
        if (error) {
            console.log('[plnkr-billing] ERROR: Failed to create customer or subscription', error);

            error = new Error('Invalid or missing plan id');
            error.statusCode = 404;

            return next(error);
        }

        const template = require('./templates/form.ejs');
        const html = Ejs.render(template, {
            baseHref: `/${ encodeURIComponent(req.x_wt.jtn) }/${ encodeURIComponent(results.plan.id) }`,
            plan: {
                id: results.plan.id,
                amount: results.plan.amount,
                currency: results.plan.currency,
                interval: results.plan.interval,
                name: results.plan.name,
            },
            stripe: {
                publishableKey: module.webtask.secrets.STRIPE_PUBLIC_KEY,
            },
            vendor: {
                email: module.webtask.secrets.VENDOR_EMAIL,
                name: module.webtask.secrets.VENDOR_NAME,
            },
        });

        return res.end(html);
    });
});

app.post('/:planId/charge', (req, res, next) => {
    return Async.autoInject({
        customer: (cb) => {
            return stripe.customers.create({
                email: req.body.stripeEmail,
                source: req.body.stripeToken,
            }, cb);
        },
        plan: (cb) => {
            return stripe.plans.retrieve(req.params.planId, cb);
        },
        subscription: (customer, plan, cb) => {
            return stripe.subscriptions.create({
                customer: customer.id,
                plan: plan.id,
            }, cb);
        },
    }, (error, results) => {
        if (error) {
            console.log('[plnkr-billing] ERROR: Failed to create customer or subscription', error);

            if (!results.plan) {
                error = new Error('Error retrieving plan');
                error.statusCode = 404;

                return next(error);
            }

            if (!results.customer) {
                error = new Error('Error creating customer');
                error.statusCode = 502;
                error.retryUrl = `/${ encodeURIComponent(req.x_wt.jtn) }/${ encodeURIComponent(results.plan.id) }`;

                return next(error);
            }

            if (!results.plan) {
                error = new Error('Error creating subscription');
                error.statusCode = 502;
                error.retryUrl = `/${ encodeURIComponent(req.x_wt.jtn) }/${ encodeURIComponent(results.plan.id) }`;

                return next(error);
            }


            error = new Error('Unknown error');
            error.retryUrl = `/${ encodeURIComponent(req.x_wt.jtn) }/${ encodeURIComponent(results.plan.id) }`;

            return next(error);
        }

        console.log('[plnkr-billing] SUCCESS: Subscription created', results);

        const template = require('./templates/success.ejs');
        const html = Ejs.render(template, {
            plan: {
                id: results.plan.id,
                amount: results.plan.amount,
                currency: results.plan.currency,
                interval: results.plan.interval,
                name: results.plan.name,
            },
            vendor: {
                email: module.webtask.secrets.VENDOR_EMAIL,
                name: module.webtask.secrets.VENDOR_NAME,
            },
        });

        return res.end(html);
    });
});

app.use('*', (req, res, next) => {
    const error = new Error('Page not found');
    error.statusCode = 404;

    return next(error);
});

app.use((error, req, res, next) => {
    const template = require('./templates/error.ejs');
    const html = Ejs.render(template, {
        error: {
            message: error.message,
            retryUrl: error.retryUrl
        },
        vendor: {
            email: module.webtask.secrets.VENDOR_EMAIL,
            name: module.webtask.secrets.VENDOR_NAME,
        },
    });

    return res
        .status(error.statusCode || 500)
        .end(html);
});

module.exports = Webtask.fromExpress(app);
