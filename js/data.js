/* =========================================================================
   VOLANTE — FORM OPTIONS
   The site no longer lists offers: customers fill out a request and the
   Volante team handles lease options on the backend. This file only holds
   the choices shown in the request form. Edit freely.
   ========================================================================= */

window.VOLANTE_DATA = {
  /* Makes offered in the "Request a vehicle" form. Only these brands are accepted,
     including from links (e.g. #/budget?make=Ford). */
  /* request form colour choices: [key, swatch colour]. Labels live in i18n.js under color.<key> */
  colorOptions: [['black', '#0b0b0d'], ['white', '#f4f4f2'], ['grey', 'linear-gradient(135deg,#9aa0a8,#5b616b)'], ['blue', '#2251c9'], ['red', '#b3121c'], ['green', '#2f5a3a'], ['other', 'conic-gradient(#e33,#fc3,#3c6,#39f,#a3f,#e33)']],
  requestMakes: ['Ford', 'Lincoln', 'Other'], // 'Other' asks for make and model in the text field

  /* Model dropdown per make (Canadian lineup, late 2026 — review each model year).
     The form adds an "Other model" choice at the end that opens a text field. */
  models: {
    Ford: ['Bronco', 'Bronco Sport', 'Escape', 'Expedition', 'Explorer', 'F-150', 'F-150 Lightning', 'Maverick', 'Mustang', 'Mustang Mach-E', 'Ranger', 'Super Duty (F-250 / F-350)', 'Transit', 'E-Transit'],
    Lincoln: ['Aviator', 'Corsair', 'Nautilus', 'Navigator']
  },

  /* Photos for the inner pages. The request page shows the chosen model's hero photo when
     there is one, otherwise `request`. The confirmation screen always uses `request`. */
  pagePhotos: {
    /* brand-neutral Montréal skyline at dusk: used on the confirmation screen, and on the request page
       when the chosen model has no hero photo */
    request: { img: 'https://images.unsplash.com/photo-1470181942237-78ce33fec141?auto=format&fit=crop&w=2400&q=80', pos: '50% 55%' },
    dealers: { img: 'assets/photos/dealers.jpg', pos: '50% 45%' }
  },

  kmOptions: [12000, 16000, 20000, 24000],
  termOptions: [24, 36, 39, 48, 60],

  /* Home hero slideshow. Photos are stored in assets/photos (dealers photo colour-graded; originals in assets/photos/originals; credits in directions/PHOTO-CREDITS.md). Each slide's button opens the
     request form with that make, model (and trim) pre-filled. `model` must match a name in `models`. Optional: `pos` (crop focus), `dim` (brightness: below 1 darkens, above 1 brightens). Swap `img` for your own photos. */
  heroSlides: [
    { make: 'Ford', model: 'Mustang', type: ['Coupé', 'Coupe'], img: 'assets/photos/mustang.jpg', pos: '60% 58%', dim: 1.3 },
    { make: 'Ford', model: 'Bronco', type: ['VUS', 'SUV'], img: 'assets/photos/bronco.jpg' },
    { make: 'Ford', model: 'F-150', type: ['Camionnette', 'Pickup'], img: 'assets/photos/f150.jpg', pos: '60% 60%', dim: 1.1 },
    { make: 'Lincoln', model: 'Aviator', type: ['VUS de luxe', 'Luxury SUV'], img: 'assets/photos/aviator.jpg', pos: '50% 62%', dim: 0.85 }
  ]
};
