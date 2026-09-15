// Puan aritmetiğinin TAMAMI tam sayı "iç birim" üzerinden yapılır.
//
// Neden: katalogdaki birim puanlar 0,20 / 0,25 / 1,25 / 2,50 gibi kesirli
// değerler. Kayan noktalı sayılarla toplanınca 0,1 + 0,2 klasiği yüzünden
// ay sonunda 89,99999 gibi tutarlar çıkıyor ve iki ekran farklı yuvarlıyor.
// 1 puan = 20 birim kabul edilirse bütün katalog değerleri tam sayıya oturuyor
// (0,05 puan = 1 birim) ve toplama/çıkarma kayıpsız oluyor. Bölme YALNIZCA
// gösterimde, en sonda yapılıyor.

export const UNITS_PER_POINT = 20;

/** Puan girişinin adım büyüklüğü: 1 birim = 0,05 puan. */
export const POINT_INPUT_STEP = 1 / UNITS_PER_POINT;

export function pointsToUnits(points: number): number {
  const units = Math.round(points * UNITS_PER_POINT);
  if (!Number.isFinite(units)) throw new Error("Puan değeri sayı olmalı.");
  return units;
}

export function unitsToPoints(units: number): number {
  return units / UNITS_PER_POINT;
}

/** Gösterim: tam sayıysa "16", değilse en fazla iki basamak ("11,25"). */
export function formatUnitsAsPoints(units: number): string {
  const points = unitsToPoints(units);
  return points.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}

/**
 * Kullanıcının yazdığı puanı birime çevirir. 0,05'in katı olmayan değer
 * REDDEDİLİR: aksi hâlde girdi sessizce yuvarlanır ve kullanıcı yazdığından
 * farklı bir tutar kaydedilir.
 */
export function parsePointInputToUnits(raw: string): number {
  const text = raw.trim().replace(",", ".");
  if (!text) throw new Error("Puan değeri zorunlu.");
  const value = Number(text);
  if (!Number.isFinite(value)) throw new Error("Puan değeri sayı olmalı.");
  const units = value * UNITS_PER_POINT;
  if (Math.abs(units - Math.round(units)) > 1e-9) {
    throw new Error("Puan 0,05'in katı olmalı (1 iç birim = 0,05 puan).");
  }
  return Math.round(units);
}
