import * as Navbar from './Navbar.js';
import * as Hero from './Hero.js';
import * as Features from './Features.js';
import * as Gallery from './Gallery.js';
import * as Testimonials from './Testimonials.js';
import * as Pricing from './Pricing.js';
import * as CTA from './CTA.js';
import * as Footer from './Footer.js';
import * as Generic from './Generic.js';

// type -> { componentName, render(props) => sourceCodeString }
export const TEMPLATES = {
  navbar: { componentName: 'Navbar', ...Navbar },
  hero: { componentName: 'Hero', ...Hero },
  features: { componentName: 'Features', ...Features },
  gallery: { componentName: 'Gallery', ...Gallery },
  testimonials: { componentName: 'Testimonials', ...Testimonials },
  pricing: { componentName: 'Pricing', ...Pricing },
  cta: { componentName: 'CTA', ...CTA },
  footer: { componentName: 'Footer', ...Footer },
  generic: { componentName: 'GenericSection', ...Generic },
};
