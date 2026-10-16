export const SNACK_IMAGE = "/images/combos.png";

// Precios transcritos de la tabla proporcionada por el organizador.
export const SNACK_OFFERS = [
  { name: "Canchita", includes: "1 cancha", price: "S/ 2.50", regular: null },
  { name: "Gaseosa", includes: "1 gaseosa", price: "S/ 3.00", regular: null },
  { name: "Dos canchas", includes: "2 canchas", price: "S/ 4.50", regular: "S/ 5.00" },
  { name: "Combo Cine", includes: "1 cancha + 1 gaseosa", price: "S/ 5.00", regular: "S/ 5.50" },
  { name: "Combo Dúo", includes: "2 canchas + 2 gaseosas", price: "S/ 10.00", regular: "S/ 11.00" },
  { name: "Combo Pandilla", includes: "4 canchas + 4 gaseosas", price: "S/ 19.00", regular: "S/ 22.00" },
  { name: "Pack Entrada + Combo", includes: "Entrada + cancha + gaseosa", price: "S/ 10.00", regular: "S/ 10.50" },
] as const;

export const SOCIAL_LINKS = {
  facebook: "https://www.facebook.com/profile.php?id=100086475223991",
  instagram: "https://www.instagram.com/cefinf.unt/",
};
