// Simplified property-status DISPLAY. The DB status enum is unchanged and still
// follows the assignment; this only collapses it for the UI into three states:
//   'rented' → "Rented", 'trial' → "Trial", everything else → "Not rented".
// (building / optimizing / producing / paused all read as Not rented — the lead
// count already shows whether a property is producing.)
export type RentalDisplay = "Rented" | "Trial" | "Not rented";

export function rentalDisplay(status: string | null | undefined): RentalDisplay {
  if (status === "rented") return "Rented";
  if (status === "trial") return "Trial";
  return "Not rented";
}
