import type { Product } from "../types";
export const products: Product[] = [
  {
    id: "raspberry",
    name: "Малина",
    description: "Ягодная кислинка и нежный сливочный крем.",
    image: "raspberry.webp",
    color: "#f4c3cb",
    price: 12000,
    ingredients: "Миндальная мука, сахар, яичный белок, сливки, малина.",
  },
  {
    id: "mango",
    name: "Манго",
    description: "Солнечный вкус с мягкой тропической нотой.",
    image: "mango.webp",
    color: "#f5d7a9",
    price: 12000,
    ingredients: "Миндальная мука, сахар, яичный белок, сливки, манго.",
  },
  {
    id: "vanilla",
    name: "Ваниль",
    description: "Деликатная классика для маленькой паузы.",
    image: "vanilla.webp",
    color: "#ead3bf",
    price: 12000,
    ingredients: "Миндальная мука, сахар, яичный белок, сливки, ваниль.",
  },
  {
    id: "pistachio",
    name: "Фисташка",
    description: "Ореховая начинка и тонкая хрустящая корочка.",
    image: "pistachio.webp",
    color: "#d8dfb9",
    price: 14000,
    ingredients: "Миндальная мука, сахар, яичный белок, сливки, фисташка.",
  },
];
export { settings } from "./shop";
export const asset = (name: string) =>
  `${import.meta.env.BASE_URL}assets/images/${name}`;
