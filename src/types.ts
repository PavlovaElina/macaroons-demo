export type Product = {
  id: string;
  name: string;
  description: string;
  image: string;
  color: string;
  price: number;
  ingredients: string;
};
export type Selection = Record<string, number>;
export type CartLine = {
  id: string;
  kind: "single" | "box";
  selection: Selection;
  capacity: number;
  packaging: "classic" | "ribbon";
  note: string;
  quantity: number;
};
export type ShopSettings = {
  deliveryFee: number;
  freeDeliveryFrom: number;
  city: string;
  pickup: string;
};
export type CheckoutData = {
  name: string;
  phone: string;
  method: "pickup" | "delivery";
  address: string;
  date: string;
  interval: string;
  comment: string;
};
export type OrderResponse = { id: string; total: number };
