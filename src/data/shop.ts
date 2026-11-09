import type { ShopSettings } from "../types";
export const PACKAGING_PRICES = { classic: 6000, ribbon: 10000 } as const;
export const RECEIPT_INTERVALS = [
  "10:00–13:00",
  "13:00–16:00",
  "16:00–19:00",
] as const;
export const settings: ShopSettings = {
  deliveryFee: 35000,
  freeDeliveryFrom: 250000,
  city: "Москва",
  pickup: "Москва, ул. Сладкая, 12",
};
