import cron from 'node-cron'
import { autoCheckout } from './autoCheckout.js'
import { runSubscriptionRenewals } from './subscriptionRenewal.js'

export function startCronJobs() {
  // Auto-checkout: runs every minute, checks if any team's session has ended
  cron.schedule('* * * * *', autoCheckout)
  console.log('✓ Auto-checkout cron started (every minute)')

  // Subscription renewals: runs daily at 06:00
  cron.schedule('0 6 * * *', runSubscriptionRenewals)
  console.log('✓ Subscription renewal cron started (daily 06:00)')
}
