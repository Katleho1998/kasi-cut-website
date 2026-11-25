import { getStore } from '@netlify/blobs';

const DAY = 86_400_000;
const localDate = timestamp => new Date(timestamp + 2 * 60 * 60 * 1000).toISOString().slice(0, 10);

export default async () => {
  const analytics = getStore({ name: 'kasi-cut-analytics', consistency: 'strong' });
  const oldDate = localDate(Date.now() - 32 * DAY);
  const oldLiveDate = localDate(Date.now() - 2 * DAY);

  for (const group of ['views', 'visitors', 'flavours', 'live']) {
    const date = group === 'live' ? oldLiveDate : oldDate;
    const { blobs } = await analytics.list({ prefix: `${group}/${date}/` });
    await Promise.all(blobs.map(({ key }) => analytics.delete(key)));
  }
};

export const config = { schedule: '30 22 * * *' };
