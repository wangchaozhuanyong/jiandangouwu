export const BUSINESS_TIME_ZONE = "Asia/Shanghai";

type DateParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
};

const chinaDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function chinaDateKey(value: Date | string): string {
  const parts = chinaDateParts(value);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function formatChinaDateTime(value: Date | string): string {
  const parts = chinaDateParts(value);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}（中国标准时间 UTC+8）`;
}

function chinaDateParts(value: Date | string): DateParts {
  const date = typeof value === "string" ? new Date(value) : value;
  if (!Number.isFinite(date.getTime())) throw new RangeError("Invalid date value");
  const values = Object.fromEntries(
    chinaDateTimeFormatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}
