// İNTURLAM amblemi — orijinal logo dosyası (`public/inturlam-logo.jpg`, 150×150,
// beyaz zemin üzerinde koyu gri çember + ikosahedron). Boyut className ile verilir
// (ör. "h-6 w-6").
//
// Kaynak zaten beyaz zeminli; koyu temada da marka işaretinin arkasını beyaz
// tutuyoruz. `rounded-full` kare köşeleri kırpar — amblem zaten daire, kayıp yok.
export default function Logo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/inturlam-logo.jpg"
      alt="İNTURLAM"
      className={`${className ?? ""} rounded-full object-cover`}
    />
  );
}
