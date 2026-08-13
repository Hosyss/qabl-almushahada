export function normalizePublicEditorialArabicText(value: string): string {
  return value
    .replaceAll("المصادر المؤهلة", "المصادر المستخدمة")
    .replaceAll("المراجع المؤهلة", "المراجع المستخدمة")
    .replaceAll("مراجع مؤهلة", "مراجع مستخدمة")
    .replaceAll("مؤهلين", "مستخدمين")
    .replaceAll("مرجع مؤهل", "مرجع مرتبط")
    .replaceAll("الدليل المؤهل", "الدليل الحالي")
    .replaceAll("اتفاق غير مؤهل", "اتفاق غير مكتمل")
    .replaceAll("Harry", "هاري");
}
