export function assertMonthPeriod(value: string): string {
  if (!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(value)) throw new Error("Geçerli bir ay seçin.");
  return value;
}

export function assertYearPeriod(value: string): string {
  if (!/^[1-9]\d{3}$/.test(value)) throw new Error("Geçerli bir yıl seçin.");
  return value;
}

export function assertShootPeriod(value: string): string {
  return value.length === 4 ? assertYearPeriod(value) : assertMonthPeriod(value);
}
