export const TAX_CATEGORIES = [
  "boro chas tax",
  "boro seed water tax",
  "potato water tax",
  "mustard water tax",
  "borsa chas water tax",         // <-- NEW
  "borsa seed/bij water tax",     // <-- NEW
  "others water tax"
];

// This helper safely translates the categories for your WhatsApp frontend
export const BENGALI_CAT_MAP = {
  "boro chas tax": "বোরো চাষ ট্যাক্স",
  "boro seed water tax": "বোরো বীজ জল ট্যাক্স",
  "potato water tax": "আলু জল ট্যাক্স",
  "mustard water tax": "সরষে জল ট্যাক্স",
  "borsa chas water tax": "বর্ষা চাষ ট্যাক্স",
  "borsa seed/bij water tax": "বর্ষা বীজ জল ট্যাক্স",
  "others water tax": "অন্যান্য জল ট্যাক্স"
};

export const getBengaliCategory = (cat) => {
  if (!cat) return "জলের বিল";
  const lowerCat = cat.toLowerCase();
  // If it's custom text, it returns the custom text. Otherwise, it translates it.
  return BENGALI_CAT_MAP[lowerCat] || cat; 
};
