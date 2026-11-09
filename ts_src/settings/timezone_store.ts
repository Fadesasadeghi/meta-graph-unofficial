import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

export interface TimezoneSettings {
  timezone: string;
  confirmed: boolean;
}

export class TimezoneStore {
  private readonly filePath: string;

  constructor(filePath = process.env.INSTAGRAM_TIMEZONE_FILE
    || join(process.cwd(), 'data', 'instagram_settings', 'timezone.json')) {
    this.filePath = resolve(filePath);
  }

  static validate(timezone: string): string {
    if (typeof timezone !== 'string' || !timezone.trim()) {
      throw new Error('Timezone must be a non-empty string.');
    }

    const value = timezone.trim();

    try {
      new Intl.DateTimeFormat('en-US', {
        timeZone: value
      }).format(new Date());
    } catch {
      throw new Error(
        `Invalid timezone: ${value}. Use an IANA timezone such as Asia/Tehran.`
      );
    }

    return value;
  }

  static detect(): string {
    const detected = Intl.DateTimeFormat()
      .resolvedOptions().timeZone;

    return TimezoneStore.validate(detected);
  }

  async get(): Promise<TimezoneSettings | null> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as TimezoneSettings;

      return {
        timezone: TimezoneStore.validate(parsed.timezone),
        confirmed: parsed.confirmed === true
      };
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async set(timezone: string): Promise<TimezoneSettings> {
    const settings: TimezoneSettings = {
      timezone: TimezoneStore.validate(timezone),
      confirmed: true
    };

    await mkdir(dirname(this.filePath), {
      recursive: true,
      mode: 0o700
    });

    const temporary = `${this.filePath}.${randomUUID()}.tmp`;

    await writeFile(
      temporary,
      JSON.stringify(settings, null, 2),
      { encoding: 'utf8', mode: 0o600, flag: 'wx' }
    );

    try {
      await rename(temporary, this.filePath);
    } catch (error) {
      const { unlink } = await import('node:fs/promises');
      await unlink(temporary).catch(() => {});
      throw error;
    }

    return settings;
  }
}
