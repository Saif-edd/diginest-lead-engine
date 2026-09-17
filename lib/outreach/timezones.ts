import { OutreachTimingState, OutreachTimingStatus } from "@/types/outreach";

interface DerivedTimezone {
  timezone: string;
  source: "DERIVED" | "MANUAL";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  weekendRule: "FRI_SAT" | "SUN_THU" | "MON_FRI" | "QATAR" | "DEFAULT";
}

const REGION_MAP: Record<string, { tz: string; rule: DerivedTimezone["weekendRule"] }> = {
  uae: { tz: "Asia/Dubai", rule: "MON_FRI" },
  dubai: { tz: "Asia/Dubai", rule: "MON_FRI" },
  "abu dhabi": { tz: "Asia/Dubai", rule: "MON_FRI" },
  sharjah: { tz: "Asia/Dubai", rule: "MON_FRI" },

  saudi: { tz: "Asia/Riyadh", rule: "FRI_SAT" },
  riyadh: { tz: "Asia/Riyadh", rule: "FRI_SAT" },
  jeddah: { tz: "Asia/Riyadh", rule: "FRI_SAT" },

  qatar: { tz: "Asia/Qatar", rule: "QATAR" },
  doha: { tz: "Asia/Qatar", rule: "QATAR" },

  kuwait: { tz: "Asia/Kuwait", rule: "FRI_SAT" },
  bahrain: { tz: "Asia/Bahrain", rule: "FRI_SAT" },
  oman: { tz: "Asia/Muscat", rule: "FRI_SAT" },
  muscat: { tz: "Asia/Muscat", rule: "FRI_SAT" },

  morocco: { tz: "Africa/Casablanca", rule: "MON_FRI" },
  casablanca: { tz: "Africa/Casablanca", rule: "MON_FRI" },
  rabat: { tz: "Africa/Casablanca", rule: "MON_FRI" },
};

export function deriveTimezone(address: string): DerivedTimezone | null {
  if (!address) return null;
  const lower = address.toLowerCase();

  for (const [key, val] of Object.entries(REGION_MAP)) {
    if (lower.includes(key)) {
      return {
        timezone: val.tz,
        source: "DERIVED",
        confidence: "HIGH",
        weekendRule: val.rule,
      };
    }
  }

  return null;
}

export function evaluateSendWindow(
  timezone: string,
  weekendRule: DerivedTimezone["weekendRule"] = "DEFAULT",
  overrideTime?: Date // for testing
): OutreachTimingState {
  try {
    const now = overrideTime || new Date();
    // Use Intl API to format in target timezone
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
      weekday: 'short',
      hourCycle: 'h12'
    };
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const timeString = formatter.format(now); // e.g., "Wed, 10:42 AM"

    // Parse hour, minute, and weekday
    const dateInTz = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const day = dateInTz.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
    const hours = dateInTz.getHours();
    const minutes = dateInTz.getMinutes();
    const decimalTime = hours + minutes / 60;

    let isWeekend = false;
    let isFridayMidday = false;

    if (day === 5) { // Friday
      // Block Friday midday (12:00 to 14:30) for prayer time generally in MENA
      if (decimalTime >= 12.0 && decimalTime < 14.5) {
        isFridayMidday = true;
      }
    }

    if (weekendRule === "FRI_SAT") {
      if (day === 5 || day === 6) isWeekend = true;
    } else if (weekendRule === "MON_FRI") {
      if (day === 0 || day === 6) isWeekend = true; // standard western weekend
    } else if (weekendRule === "QATAR") {
      if (day === 5) isWeekend = true; // Friday blocked, Saturday context dependent
    } else {
      if (day === 0 || day === 6) isWeekend = true;
    }

    if (isWeekend) {
      return {
        prospectLocalTime: timeString,
        status: "WAIT",
        reason: "Outside business days",
      };
    }

    if (isFridayMidday) {
      return {
        prospectLocalTime: timeString,
        status: "WAIT",
        reason: "Friday prayer time",
      };
    }

    // Windows: 09:30–12:00 (9.5 to 12.0), 14:30–17:30 (14.5 to 17.5)
    const inMorningWindow = decimalTime >= 9.5 && decimalTime < 12.0;
    const inAfternoonWindow = decimalTime >= 14.5 && decimalTime < 17.5;

    if (inMorningWindow || inAfternoonWindow) {
      return {
        prospectLocalTime: timeString,
        status: "SEND_NOW",
      };
    }

    return {
      prospectLocalTime: timeString,
      status: "WAIT",
      reason: "Outside recommended send windows",
    };
  } catch (error) {
    // Fallback if timezone is invalid
    return {
      prospectLocalTime: null,
      status: "REVIEW_TIMEZONE",
      reason: "Invalid timezone",
    };
  }
}
