import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSport, SPORTS } from "../sports";

export default function SportPicker({ value, onChange, locked }) {
  const sport = getSport(value);

  if (locked) {
    return (
      <Badge variant="secondary" className="h-7 gap-1.5 rounded-full px-3 text-sm">
        <span className="text-base leading-none">{sport.emoji}</span>
        <span>{sport.label}</span>
      </Badge>
    );
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 rounded-full">
        <SelectValue>
          <span className="flex items-center gap-1.5">
            <span className="text-base leading-none">{sport.emoji}</span>
            <span>{sport.label}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end" position="popper" sideOffset={6}>
        {SPORTS.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            <span className="text-base leading-none">{s.emoji}</span>
            <span>{s.label}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
