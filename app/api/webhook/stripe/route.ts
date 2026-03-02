import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-02-25.clover'
})

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
    try {
        const body = await request.text()
        const headersList = await headers()
        const sig = headersList.get('stripe-signature')!

        let event: Stripe.Event

        try {
            event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
        } catch (error) {
            console.error('webhook signature failed:', error)
            return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
        }

        switch (event.type) {
            case 'customer.subscription.created':
                await handleSubscriptionCreated(event.data.object)
                break
            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(event.data.object)
                break
            case 'customer.subscription.deleted':
                await handleSubscriptionCancelled(event.data.object)
                break
            case 'invoice.payment_succeeded':
                // Pass the full event so we can access the correctly typed object
                await handlePaymentSucceeded(event)
                break
            default:
                console.log(`unhandled event type: ${event.type}`)
        }

        return NextResponse.json({ received: true })
    } catch (error) {
        console.error('webhook handler error:', error)
        return NextResponse.json({ error: 'webhook failed' }, { status: 500 })
    }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
    try {
        const customerId = subscription.customer as string
        const planName = getPlanFromSubscription(subscription)

        const user = await prisma.user.findFirst({
            where: { stripeCustomerId: customerId }
        })

        if (!user) {
            console.error('No user found for customerId:', customerId)
            return
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                currentPlan: planName,
                subscriptionStatus: subscription.status,
                stripeSubscriptionId: subscription.id,
                billingPeriodStart: new Date(),
                meetingsThisMonth: 0,
                chatMessagesToday: 0
            }
        })
    } catch (error) {
        console.error('error handling subscription created:', error)
    }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    try {
        const user = await prisma.user.findFirst({
            where: { stripeSubscriptionId: subscription.id }
        })

        if (!user) {
            console.error('No user found for subscriptionId:', subscription.id)
            return
        }

        const planName = getPlanFromSubscription(subscription)

        const activeStatuses = ['active', 'trialing']
        const subscriptionStatus = activeStatuses.includes(subscription.status)
            ? 'active'
            : subscription.status

        await prisma.user.update({
            where: { id: user.id },
            data: {
                currentPlan: planName,
                subscriptionStatus
            }
        })
    } catch (error) {
        console.error('error handling subscription updated:', error)
    }
}

async function handleSubscriptionCancelled(subscription: Stripe.Subscription) {
    try {
        const user = await prisma.user.findFirst({
            where: { stripeSubscriptionId: subscription.id }
        })

        if (!user) {
            console.error('No user found for subscriptionId:', subscription.id)
            return
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                currentPlan: 'free',
                subscriptionStatus: 'cancelled',
                stripeSubscriptionId: null,
                meetingsThisMonth: 0,
                chatMessagesToday: 0
            }
        })
    } catch (error) {
        console.error('error handling subscription cancelled:', error)
    }
}

async function handlePaymentSucceeded(event: Stripe.InvoicePaymentSucceededEvent) {
    try {
        const invoice = event.data.object

        // In API version 2026-02-25.clover, `invoice.subscription` was removed.
        // The subscription ID now lives under invoice.parent.subscription_details.subscription
        const raw = invoice.parent?.subscription_details?.subscription ?? null
        const subscriptionId: string | null =
            raw === null ? null
            : typeof raw === 'string' ? raw
            : raw.id

        if (!subscriptionId) return

        const user = await prisma.user.findFirst({
            where: { stripeSubscriptionId: subscriptionId }
        })

        if (!user) {
            console.error('No user found for subscriptionId:', subscriptionId)
            return
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                subscriptionStatus: 'active',
                billingPeriodStart: new Date(),
                meetingsThisMonth: 0,
                chatMessagesToday: 0
            }
        })
    } catch (error) {
        console.error('error handling payment succeeded:', error)
    }
}

function getPlanFromSubscription(subscription: Stripe.Subscription): string {
    const priceId = subscription.items.data[0]?.price.id

    const priceToPlan: Record<string, string> = {
        'price_1T6akuCLT43EPZa1WS0BGTNh': 'starter',
        'price_1T6akuCLT43EPZa1ob2KlXV8': 'pro',
        'price_1T6akuCLT43EPZa1v1MdwFOA': 'premium'
    }

    return priceToPlan[priceId] || 'free'
}