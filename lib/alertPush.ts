import { generateVAPIDKeys, sendNotification, WebPushError } from "web-push";
import { claimPushJobs, finishPushJob, getPushKeys, removePushDevice } from "./db";

export async function pushSettings() {
  const subject = process.env.ALERT_PUSH_SUBJECT?.trim();
  if (!subject || !/^(mailto:[^\s@]+@[^\s@]+\.[^\s@]+|https:\/\/[^\s]+)$/i.test(subject)) return null;
  return { subject, ...await getPushKeys(generateVAPIDKeys) };
}

export function isPushEndpoint(value: string) {
  if (value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.port && !url.username && !url.password && !url.hash &&
      /^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)$/i.test(url.hostname);
  } catch {
    return false;
  }
}

export async function deliverAlertPush() {
  const vapidDetails = await pushSettings();
  if (!vapidDetails) return;
  await Promise.all((await claimPushJobs(Date.now())).map(async (job) => {
    try {
      if (isPushEndpoint(job.endpoint)) {
        await sendNotification(
          { endpoint: job.endpoint, keys: { p256dh: job.p256dh, auth: job.auth_key } },
          JSON.stringify({ tag: job.event_id }),
          { vapidDetails, TTL: 3600, timeout: 8000 },
        );
      }
      await finishPushJob(job.event_id, job.endpoint);
    } catch (error) {
      const status = error instanceof WebPushError ? error.statusCode : undefined;
      if (status === 404 || status === 410) await removePushDevice(job.endpoint, job.user_id);
      else if (status === 400 || status === 413) await finishPushJob(job.event_id, job.endpoint);
    }
  }));
}
