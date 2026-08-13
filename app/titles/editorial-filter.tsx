import { EDITORIAL_FILTER_OPTIONS } from "./editorial-filter-options";

export function EditorialFilter({ value }: { value: string }) {
  return (
    <label>
      <span>التحليل التحريري</span>
      <select name="editorialStatus" defaultValue={value}>
        {EDITORIAL_FILTER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}
