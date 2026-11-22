export const brandAssets = {
  "group": {
    "name": "XpressGroup",
    "width": 739,
    "height": 212
  },
  "pro": {
    "name": "XpressPro",
    "width": 765,
    "height": 212
  },
  "consulting": {
    "name": "XpressConsulting",
    "width": 888,
    "height": 212
  },
  "clean": {
    "name": "XpressClean",
    "width": 715,
    "height": 212
  },
  "fipp": {
    "name": "FIPP Africa",
    "width": 816,
    "height": 212
  }
} as const;
export type Brand = keyof typeof brandAssets;
