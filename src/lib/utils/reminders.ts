import {
  AlertSeverity,
  AlertType,
  AppAlert,
  NotificationPreferences,
  Subscription,
} from '../types';
import { getDaysUntil, formatDate, formatShortDate } from './dates';
import { formatCurrency } from './currency';

const DISMISSED_ALERTS_KEY = 'sift_dismissed_alerts_v1';

/**
 * Derives active, actionable in-app reminders from user subscriptions.
 * Excludes archived, canceled, and paused subscriptions.
 */
export function deriveAppAlerts(
  subscriptions: Subscription[],
  preferences?: Partial<NotificationPreferences>,
  dismissedIds: string[] = []
): AppAlert[] {
  const activeSubs = subscriptions.filter((s) => s.status === 'active');
  const alerts: AppAlert[] = [];

  const notifyRenewals = preferences?.notifyRenewals !== false;
  const notifyTrials = preferences?.notifyTrials !== false;
  const maxDaysLookahead = 7;

  activeSubs.forEach((sub) => {
    // 1. Free Trial Alerts (Critical)
    if (sub.is_trial && sub.trial_end_date && notifyTrials) {
      const daysUntilTrial = getDaysUntil(sub.trial_end_date);

      if (daysUntilTrial >= -2 && daysUntilTrial <= maxDaysLookahead) {
        let severity: AlertSeverity = 'warning';
        let message = `You start paying in ${daysUntilTrial} days.`;

        if (daysUntilTrial <= 0) {
          severity = 'urgent';
          message =
            daysUntilTrial === 0
              ? 'Free trial ends today. Cancel now if you do not want to pay.'
              : `Trial ended ${Math.abs(daysUntilTrial)} days ago. Check if you were charged.`;
        } else if (daysUntilTrial === 1) {
          severity = 'urgent';
          message = 'Free trial ends tomorrow. Cancel today if you don\'t want it.';
        } else if (daysUntilTrial <= 3) {
          severity = 'urgent';
          message = `Free trial ends in ${daysUntilTrial} days (${formatDate(sub.trial_end_date)}).`;
        }

        const alertId = `trial-${sub.id}-${sub.trial_end_date}`;

        if (!dismissedIds.includes(alertId)) {
          alerts.push({
            id: alertId,
            subscriptionId: sub.id,
            subscriptionName: sub.name,
            type: 'trial_ending',
            title: `${sub.name} trial ending`,
            message,
            targetDate: sub.trial_end_date,
            daysUntil: daysUntilTrial,
            amount: sub.amount,
            currency: sub.currency,
            severity,
            cancelUrl: sub.cancel_url,
            isTrial: true,
            status: sub.status,
          });
        }
      }
    }

    // 2. Upcoming Renewal Alerts. Skipped when the trial alert above already covers the same day.
    const trialAlertSameDay =
      alerts.at(-1)?.subscriptionId === sub.id &&
      alerts.at(-1)?.type === 'trial_ending' &&
      sub.trial_end_date === sub.next_renewal_date;
    if (notifyRenewals && !trialAlertSameDay) {
      const daysUntilRenewal = getDaysUntil(sub.next_renewal_date);

      // We surface renewals within lookahead window or slightly overdue
      if (daysUntilRenewal >= -2 && daysUntilRenewal <= maxDaysLookahead) {
        let alertType: AlertType = 'renewal_upcoming';
        let severity: AlertSeverity = 'info';
        let message = `Renews in ${daysUntilRenewal} days for ${formatCurrency(sub.amount, sub.currency)}.`;

        if (daysUntilRenewal < 0) {
          alertType = 'renewal_overdue';
          severity = 'warning';
          message = `This was due ${Math.abs(daysUntilRenewal)} days ago. Check if you paid, or fix the date.`;
        } else if (daysUntilRenewal === 0) {
          alertType = 'renewal_today';
          severity = 'urgent';
          message = `Renews today for ${formatCurrency(sub.amount, sub.currency)}.`;
        } else if (daysUntilRenewal === 1) {
          severity = 'warning';
          message = `Renews tomorrow for ${formatCurrency(sub.amount, sub.currency)}.`;
        } else if (daysUntilRenewal <= 3) {
          severity = 'warning';
          message = `Renews in ${daysUntilRenewal} days (${formatShortDate(sub.next_renewal_date)}) for ${formatCurrency(sub.amount, sub.currency)}.`;
        }

        const alertId = `renewal-${sub.id}-${sub.next_renewal_date}`;

        if (!dismissedIds.includes(alertId)) {
          alerts.push({
            id: alertId,
            subscriptionId: sub.id,
            subscriptionName: sub.name,
            type: alertType,
            title: `${sub.name} renewal`,
            message,
            targetDate: sub.next_renewal_date,
            daysUntil: daysUntilRenewal,
            amount: sub.amount,
            currency: sub.currency,
            severity,
            cancelUrl: sub.cancel_url,
            isTrial: false,
            status: sub.status,
          });
        }
      }
    }
  });

  // Sort by urgency: trials & urgent renewals first, then closest days
  return alerts.sort((a, b) => {
    const severityWeight: Record<AlertSeverity, number> = {
      urgent: 3,
      warning: 2,
      info: 1,
    };
    if (severityWeight[b.severity] !== severityWeight[a.severity]) {
      return severityWeight[b.severity] - severityWeight[a.severity];
    }
    return a.daysUntil - b.daysUntil;
  });
}

/**
 * Local storage helper for dismissed alert IDs
 */
export function getDismissedAlerts(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(DISMISSED_ALERTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveDismissedAlert(alertId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getDismissedAlerts();
    if (!current.includes(alertId)) {
      localStorage.setItem(DISMISSED_ALERTS_KEY, JSON.stringify([...current, alertId]));
    }
  } catch (err) {
    console.error('Failed to save dismissed alert:', err);
  }
}
