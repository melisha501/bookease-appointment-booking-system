// mockData.js — dummy data for UI development ONLY.
// No real database, no API calls. The DemoContext (src/store/DemoContext.jsx)
// clones this data into browser storage so the demo can be interactive.
// Pages only read through the context — never fake a database write.
//
// Categories match clinics, salons, consultancy firms & training academies.

export const categories = [
  { id: 'all', name: 'All' },
  { id: 'clinics', name: 'Clinics' },
  { id: 'salons', name: 'Salons' },
  { id: 'consultancy', name: 'Consultancy' },
  { id: 'training', name: 'Training Academies' },
];

const IMG = (id) =>
  `https://images.unsplash.com/${id}?w=800&q=80&auto=format&fit=crop`;

export const services = [
  {
    id: 'dental-checkup',
    name: 'Dental Check-up & Cleaning',
    description:
      'Complete oral cleaning, gum health check and a dentist examination. Keep your smile healthy with modern, painless equipment.',
    category: 'clinics',
    categoryName: 'Clinics',
    price: 'NPR 2,500',
    duration: 45,
    rating: 5.0,
    image: IMG('photo-1588776814546-1ffcf47267a5'),
    benefits: ['Modern, painless equipment', 'Personalised care plan', 'Same-day report'],
  },
  {
    id: 'skin-clinic-consultation',
    name: 'Skin & Hair Clinic Consultation',
    description:
      'One-to-one consultation to identify skin or hair concerns, with a simple written care routine you can follow at home.',
    category: 'clinics',
    categoryName: 'Clinics',
    price: 'NPR 1,500',
    duration: 30,
    rating: 4.9,
    image: IMG('photo-1616394584738-fc6e612e71b9'),
    benefits: ['Honest, no-pressure advice', 'Written routine plan', 'Follow-up check-in'],
  },
  {
    id: 'haircut-styling',
    name: 'Haircut & Styling',
    description:
      'Consultation, wash and precision cut with professional styling. Suitable for all hair types and lengths.',
    category: 'salons',
    categoryName: 'Salons',
    price: 'NPR 1,500',
    duration: 60,
    rating: 4.9,
    image: IMG('photo-1560066984-138dadb4c035'),
    benefits: ['Free consultation before the service', 'Premium hair care products', 'Style guide for home care'],
  },
  {
    id: 'facial-treatment',
    name: 'Signature Facial Treatment',
    description:
      'Deep-cleansing facial tailored to your skin type: exfoliation, extraction, mask and hydration for a lasting glow.',
    category: 'salons',
    categoryName: 'Salons',
    price: 'NPR 2,000',
    duration: 60,
    rating: 4.8,
    image: IMG('photo-1570172619644-dfd03ed5d881'),
    benefits: ['Skin analysis at start', 'Products for your skin type', 'Visible glow after one session'],
  },
  {
    id: 'business-consulting',
    name: 'Small Business Consulting',
    description:
      'Practical one-to-one consulting for small businesses: pricing, customer follow-up and simple growth plans you can start now.',
    category: 'consultancy',
    categoryName: 'Consultancy',
    price: 'NPR 2,500',
    duration: 60,
    rating: 4.8,
    image: IMG('photo-1454165804606-c3d57bc86b40'),
    benefits: ['Actionable checklist', 'No jargon — simple plan', 'Follow-up call included'],
  },
  {
    id: 'career-consultation',
    name: 'Career Consultation',
    description:
      'One-to-one career guidance: choose a field, prepare for interviews and plan your next steps with an experienced consultant.',
    category: 'consultancy',
    categoryName: 'Consultancy',
    price: 'NPR 2,000',
    duration: 45,
    rating: 4.9,
    image: IMG('photo-1521737711867-e3b97375f902'),
    benefits: ['Personal career roadmap', 'Interview tips', 'CV review included'],
  },
  {
    id: 'spoken-english-training',
    name: 'Spoken English Training',
    description:
      'Personalised speaking practice with an instructor: daily conversation, grammar correction and interview preparation.',
    category: 'training',
    categoryName: 'Training Academies',
    price: 'NPR 2,000',
    duration: 60,
    rating: 4.7,
    image: IMG('photo-1588072432836-e10032774350'),
    benefits: ['For all levels', 'Practice notes provided', 'Certificate on completion'],
  },
  {
    id: 'computer-training',
    name: 'Computer & IT Training',
    description:
      'Foundation computer course: MS Office, email, online forms and safe internet use — perfect for beginners.',
    category: 'training',
    categoryName: 'Training Academies',
    price: 'NPR 2,500',
    duration: 90,
    rating: 4.8,
    image: IMG('photo-1531482615303-5825425587ec'),
    benefits: ['Hands-on computer practice', 'Simple Nepali/English materials', 'Certificate on completion'],
  },
];

export const specialists = [
  {
    id: 'sita-sharma',
    name: 'Sita Sharma',
    title: 'Senior Hair & Beauty Stylist',
    experience: 8,
    rating: 4.9,
    specialty: 'Salons',
    image: IMG('photo-1494790108377-be9c29b29330'),
  },
  {
    id: 'ramesh-karki',
    name: 'Ramesh Karki',
    title: 'Massage & Skin Therapist',
    experience: 10,
    rating: 4.8,
    specialty: 'Salons',
    image: IMG('photo-1507003211169-0a1dd7228f2d'),
  },
  {
    id: 'anjali-thapa',
    name: 'Anjali Thapa',
    title: 'Dental Surgeon',
    experience: 12,
    rating: 5.0,
    specialty: 'Clinics',
    image: IMG('photo-1438761681033-6461ffad8d80'),
  },
  {
    id: 'bishnu-gurung',
    name: 'Bishnu Gurung',
    title: 'Business Consultant',
    experience: 9,
    rating: 4.8,
    specialty: 'Consultancy',
    image: IMG('photo-1500648767791-00dcc994a43e'),
  },
  {
    id: 'pooja-shrestha',
    name: 'Pooja Shrestha',
    title: 'Skin & Hair Specialist',
    experience: 7,
    rating: 4.9,
    specialty: 'Clinics',
    image: IMG('photo-1544005313-94ddf0286df2'),
  },
  {
    id: 'dipak-adhikari',
    name: 'Dipak Adhikari',
    title: 'Computer & Language Trainer',
    experience: 8,
    rating: 4.9,
    specialty: 'Training Academies',
    image: IMG('photo-1472099645785-5658abf4ff4e'),
  },
];

// Sample appointments — statuses: pending | confirmed | completed | cancelled
// Demo dates are relative to "today" so upcoming/past and the 24-hour rule work live.
// (Built once when this file loads.)
function isoDaysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export const appointments = [
  {
    id: 'APT-1001',
    customer: 'Melisha Thapa',
    service: 'Haircut & Styling',
    specialist: 'Sita Sharma',
    date: isoDaysFromNow(2),
    time: '10:00 AM',
    status: 'confirmed',
    notes: 'Please keep the length above the ears.',
    phone: '9812345678',
    email: 'melisha@example.com',
  },
  {
    id: 'APT-1002',
    customer: 'Melisha Thapa',
    service: 'Signature Facial Treatment',
    specialist: 'Ramesh Karki',
    date: isoDaysFromNow(3),
    time: '11:30 AM',
    status: 'pending',
    notes: 'Dry and sensitive skin.',
    phone: '9812345678',
    email: 'melisha@example.com',
  },
  {
    id: 'APT-1003',
    customer: 'Melisha Thapa',
    service: 'Dental Check-up & Cleaning',
    specialist: 'Anjali Thapa',
    date: isoDaysFromNow(-2),
    time: '09:00 AM',
    status: 'completed',
    notes: '',
    phone: '9812345678',
    email: 'melisha@example.com',
  },
  {
    id: 'APT-1004',
    customer: 'Sagar Poudel',
    service: 'Small Business Consulting',
    specialist: 'Bishnu Gurung',
    date: isoDaysFromNow(4),
    time: '02:00 PM',
    status: 'pending',
    notes: 'New shop — needs pricing help.',
    phone: '9856789012',
    email: 'sagar@example.com',
  },
  {
    id: 'APT-1005',
    customer: 'Kabita Rai',
    service: 'Spoken English Training',
    specialist: 'Dipak Adhikari',
    date: isoDaysFromNow(-5),
    time: '04:00 PM',
    status: 'cancelled',
    notes: 'Cancelled by customer.',
    phone: '9865432109',
    email: 'kabita@example.com',
  },
];

export const testimonials = [
  {
    id: 1,
    name: 'Melisha Thapa',
    role: 'Salon customer',
    quote:
      'Booking took less than a minute and the service was excellent. I now book all my salon visits here.',
  },
  {
    id: 2,
    name: 'Sagar Poudel',
    role: 'Business owner',
    quote:
      'The consultant gave me a clear, simple plan for my shop. The pricing was upfront with no hidden charges.',
  },
  {
    id: 3,
    name: 'Kabita Rai',
    role: 'Student',
    quote:
      'Clear pricing, on-time appointments and friendly staff. The best booking experience I have had.',
  },
];

export const timeSlots = [
  '09:00 AM',
  '09:30 AM',
  '10:00 AM',
  '10:30 AM',
  '11:00 AM',
  '11:30 AM',
  '12:00 PM',
  '01:00 PM',
  '02:00 PM',
  '03:00 PM',
  '04:00 PM',
  '05:00 PM',
];

// Default working schedule per specialist (editable in Admin → Working Hours).
// Days use short names; "Sunday" is a day off. Break = lunch break with no slots.
export const schedules = {
  'sita-sharma': { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], start: '09:00 AM', end: '05:00 PM', breakStart: '01:00 PM', breakEnd: '02:00 PM' },
  'ramesh-karki': { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], start: '09:00 AM', end: '05:00 PM', breakStart: '01:00 PM', breakEnd: '02:00 PM' },
  'anjali-thapa': { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], start: '09:00 AM', end: '04:00 PM', breakStart: '12:00 PM', breakEnd: '01:00 PM' },
  'bishnu-gurung': { days: ['Mon', 'Wed', 'Fri', 'Sat'], start: '10:00 AM', end: '04:00 PM', breakStart: '01:00 PM', breakEnd: '02:00 PM' },
  'pooja-shrestha': { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], start: '09:00 AM', end: '05:00 PM', breakStart: '01:00 PM', breakEnd: '02:00 PM' },
  'dipak-adhikari': { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], start: '09:00 AM', end: '05:00 PM', breakStart: '01:00 PM', breakEnd: '02:00 PM' },
};

// Demo customer profile for Profile page (name updated per brief).
export const customerProfile = {
  fullName: 'Melisha Thapa',
  email: 'melisha@example.com',
  phone: '9812345678',
  address: 'Kathmandu, Nepal',
  memberSince: 'January 2024',
};
