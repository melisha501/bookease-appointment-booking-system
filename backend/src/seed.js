// Seed script: categories, services, specialists, schedules, assignments, and admin account.
// Stores data in PostgreSQL via Prisma. Safe to run multiple times (upserts by unique slugs/emails).
// Does NOT drop/reset the database and does NOT delete existing user accounts or appointments.

require("dotenv").config();
const bcrypt = require("bcryptjs");
const prisma = require("./lib/prisma");

const IMG = (id) => `https://images.unsplash.com/${id}?w=800&q=80&auto=format&fit=crop`;

// Required categories (per project requirements)
const categories = [
  { slug: "clinics", name: "Clinics" },
  { slug: "dental-care", name: "Dental Care" },
  { slug: "salon-beauty", name: "Salon & Beauty" },
  { slug: "massage-spa", name: "Massage & Spa" },
  { slug: "consultancy", name: "Consultancy" },
  { slug: "training-education", name: "Training & Education" },
];

const services = [
  // Clinics (4)
  {
    slug: "general-health-consultation",
    name: "General Health Consultation",
    description:
      "A thorough consultation to discuss symptoms, routine check-up needs, preventive care, and practical health guidance.",
    categorySlug: "clinics",
    priceNpr: 1200,
    durationMins: 30,
    imageUrl: IMG("photo-1631217868264-e5b90bb7e133"),
    benefits: ["Symptom review", "Preventive guidance", "Health recommendations"],
  },
  {
    slug: "family-medicine-visit",
    name: "Family Medicine Visit",
    description:
      "Comprehensive primary care visit for common illnesses, follow-ups, medication review, and family health concerns.",
    categorySlug: "clinics",
    priceNpr: 1500,
    durationMins: 40,
    imageUrl: IMG("photo-1666214280557-f1b5022eb634"),
    benefits: ["Primary care assessment", "Medication guidance", "Follow-up planning"],
  },
  {
    slug: "blood-pressure-diabetes-check",
    name: "Blood Pressure & Diabetes Check",
    description:
      "Focused screening visit for blood pressure and blood sugar monitoring with lifestyle and follow-up advice.",
    categorySlug: "clinics",
    priceNpr: 900,
    durationMins: 25,
    imageUrl: IMG("photo-1579684385127-1ef15d508118"),
    benefits: ["BP & glucose screening", "Risk discussion", "Lifestyle recommendations"],
  },
  {
    slug: "pediatric-consultation",
    name: "Pediatric Consultation",
    description:
      "Child-friendly consultation for common childhood concerns, growth guidance, and preventive care advice for parents.",
    categorySlug: "clinics",
    priceNpr: 1400,
    durationMins: 35,
    imageUrl: IMG("photo-1581594693702-fbdc51b2763b"),
    benefits: ["Child health assessment", "Parent guidance", "Preventive care advice"],
  },

  // Dental Care (4)
  {
    slug: "dental-checkup-cleaning",
    name: "Dental Check-up & Cleaning",
    description:
      "Comprehensive dental examination with scaling, polishing, and personalized oral hygiene guidance for healthy teeth and gums.",
    categorySlug: "dental-care",
    priceNpr: 2500,
    durationMins: 45,
    imageUrl: IMG("photo-1588776814546-1ffcf47267a5"),
    benefits: ["Dental examination", "Scaling & polishing", "Oral hygiene advice"],
  },
  {
    slug: "tooth-filling-consultation",
    name: "Tooth Filling Consultation",
    description:
      "Assessment for cavities or tooth sensitivity with treatment planning and guidance for restorative care.",
    categorySlug: "dental-care",
    priceNpr: 1800,
    durationMins: 30,
    imageUrl: IMG("photo-1606811841689-23dfddce3e95"),
    benefits: ["Cavity assessment", "Treatment planning", "Care guidance"],
  },
  {
    slug: "teeth-whitening-session",
    name: "Teeth Whitening Session",
    description:
      "Professional whitening session to brighten your smile safely, with aftercare tips for lasting results.",
    categorySlug: "dental-care",
    priceNpr: 6500,
    durationMins: 60,
    imageUrl: IMG("photo-1609840114035-3c981b782dfe"),
    benefits: ["Professional whitening", "Shade assessment", "Aftercare guidance"],
  },
  {
    slug: "orthodontic-consultation",
    name: "Orthodontic Consultation",
    description:
      "Consultation for braces or alignment concerns with an initial assessment and treatment pathway discussion.",
    categorySlug: "dental-care",
    priceNpr: 2000,
    durationMins: 40,
    imageUrl: IMG("photo-1598256989800-fe5f95da9787"),
    benefits: ["Alignment assessment", "Treatment options", "Next-step planning"],
  },

  // Salon & Beauty (4)
  {
    slug: "haircut-styling",
    name: "Haircut & Styling",
    description:
      "Consultation, wash, precision haircut, and styling tailored to your look, hair type, and occasion.",
    categorySlug: "salon-beauty",
    priceNpr: 1500,
    durationMins: 60,
    imageUrl: IMG("photo-1560066984-138dadb4c035"),
    benefits: ["Style consultation", "Wash & cut", "Professional finish"],
  },
  {
    slug: "hair-coloring",
    name: "Hair Coloring",
    description:
      "Professional hair coloring with shade consultation, careful application, and aftercare guidance for lasting results.",
    categorySlug: "salon-beauty",
    priceNpr: 3500,
    durationMins: 90,
    imageUrl: IMG("photo-1522337360788-8b13dee7a37e"),
    benefits: ["Shade consultation", "Color application", "Aftercare tips"],
  },
  {
    slug: "facial-treatment",
    name: "Facial Treatment",
    description:
      "Deep-cleansing facial customized to your skin type to refresh, hydrate, and restore a healthy glow.",
    categorySlug: "salon-beauty",
    priceNpr: 2000,
    durationMins: 60,
    imageUrl: IMG("photo-1570172619644-dfd03ed5d881"),
    benefits: ["Deep cleansing", "Skin-type care", "Relaxing treatment"],
  },
  {
    slug: "manicure-pedicure",
    name: "Manicure & Pedicure",
    description:
      "Complete nail care for hands and feet with hygienic tools, shaping, cuticle care, and a polished finish.",
    categorySlug: "salon-beauty",
    priceNpr: 1200,
    durationMins: 60,
    imageUrl: IMG("photo-1604654894610-df63bc536371"),
    benefits: ["Nail shaping", "Cuticle care", "Clean, polished finish"],
  },

  // Massage & Spa (4)
  {
    slug: "full-body-massage",
    name: "Full Body Massage",
    description:
      "A soothing full body massage designed to relieve tension, improve circulation, and help you fully unwind.",
    categorySlug: "massage-spa",
    priceNpr: 2200,
    durationMins: 60,
    imageUrl: IMG("photo-1544161515-4ab6ce6db874"),
    benefits: ["Full body relaxation", "Muscle tension relief", "Calming spa experience"],
  },
  {
    slug: "relaxation-massage",
    name: "Relaxation Massage",
    description:
      "Gentle, calming massage focused on stress relief and relaxation in a peaceful spa setting.",
    categorySlug: "massage-spa",
    priceNpr: 1800,
    durationMins: 45,
    imageUrl: IMG("photo-1519823551278-64ac92734fb1"),
    benefits: ["Stress relief", "Gentle techniques", "Peaceful experience"],
  },
  {
    slug: "deep-tissue-massage",
    name: "Deep Tissue Massage",
    description:
      "Targeted deep tissue therapy to ease chronic muscle tightness and support recovery after strain or fatigue.",
    categorySlug: "massage-spa",
    priceNpr: 2600,
    durationMins: 60,
    imageUrl: IMG("photo-1515377905703-c4788e51af15"),
    benefits: ["Targeted pressure", "Muscle recovery support", "Tension release"],
  },
  {
    slug: "aromatherapy-spa-session",
    name: "Aromatherapy Spa Session",
    description:
      "A calming spa session combining light massage techniques with aromatic oils for relaxation and mental refreshment.",
    categorySlug: "massage-spa",
    priceNpr: 2400,
    durationMins: 60,
    imageUrl: IMG("photo-1600334129128-685c5582fd35"),
    benefits: ["Aromatic relaxation", "Stress reduction", "Spa rejuvenation"],
  },

  // Consultancy (4)
  {
    slug: "business-consultation",
    name: "Business Consultation",
    description:
      "Practical business guidance covering planning, pricing, operations, and growth strategies for your goals.",
    categorySlug: "consultancy",
    priceNpr: 2500,
    durationMins: 60,
    imageUrl: IMG("photo-1454165804606-c3d57bc86b40"),
    benefits: ["Actionable advice", "Planning & strategy", "Growth-focused discussion"],
  },
  {
    slug: "career-guidance",
    name: "Career Guidance",
    description:
      "One-on-one career guidance for study choices, job preparation, skill development, and professional direction.",
    categorySlug: "consultancy",
    priceNpr: 1800,
    durationMins: 45,
    imageUrl: IMG("photo-1521737604893-d14cc237f11d"),
    benefits: ["Career planning", "Skill & goal review", "Practical next steps"],
  },
  {
    slug: "financial-planning-consultation",
    name: "Financial Planning Consultation",
    description:
      "Personal finance consultation covering budgeting, savings goals, and practical planning for financial stability.",
    categorySlug: "consultancy",
    priceNpr: 2200,
    durationMins: 50,
    imageUrl: IMG("photo-1554224155-6726b3ff858f"),
    benefits: ["Budget planning", "Goal setting", "Practical recommendations"],
  },
  {
    slug: "startup-mentoring-session",
    name: "Startup Mentoring Session",
    description:
      "Mentoring for early-stage founders on idea validation, customer discovery, and building an execution roadmap.",
    categorySlug: "consultancy",
    priceNpr: 3000,
    durationMins: 60,
    imageUrl: IMG("photo-1556761175-b413da4baf72"),
    benefits: ["Idea validation", "Execution roadmap", "Founder mentoring"],
  },

  // Training & Education (4)
  {
    slug: "computer-training",
    name: "Computer Training",
    description:
      "Hands-on computer fundamentals training for everyday productivity, office tools, and confident digital skills.",
    categorySlug: "training-education",
    priceNpr: 2500,
    durationMins: 90,
    imageUrl: IMG("photo-1516321318423-f06f85e504b3"),
    benefits: ["Practical exercises", "Office & internet basics", "Beginner-friendly pace"],
  },
  {
    slug: "web-development-training",
    name: "Web Development Training",
    description:
      "Beginner-friendly web development training covering HTML, CSS, JavaScript basics, and small practical projects.",
    categorySlug: "training-education",
    priceNpr: 3500,
    durationMins: 90,
    imageUrl: IMG("photo-1517694712202-14dd9538aa97"),
    benefits: ["HTML/CSS/JS basics", "Hands-on practice", "Project guidance"],
  },
  {
    slug: "programming-classes",
    name: "Programming Classes",
    description:
      "Structured programming classes focused on core concepts, problem-solving, and writing clean beginner-level code.",
    categorySlug: "training-education",
    priceNpr: 3000,
    durationMins: 90,
    imageUrl: IMG("photo-1515879218367-8466d910aaa4"),
    benefits: ["Core programming concepts", "Problem-solving practice", "Guided learning"],
  },
  {
    slug: "digital-marketing-training",
    name: "Digital Marketing Training",
    description:
      "Practical training on social media, content basics, and online promotion strategies for small businesses and learners.",
    categorySlug: "training-education",
    priceNpr: 2800,
    durationMins: 75,
    imageUrl: IMG("photo-1460925895917-afdab827c52f"),
    benefits: ["Social media basics", "Content planning", "Practical promotion tips"],
  },
];

const specialists = [
  // Clinics (2)
  {
    slug: "anisha-sharma",
    name: "Dr. Anisha Sharma",
    title: "General Physician (MBBS)",
    bio: "Experienced general physician providing routine consultations, preventive care, and patient-centered health guidance for adults and families.",
    experience: 9,
    specialty: "Clinics",
    imageUrl: IMG("photo-1559839734-2b71ea197ec2"),
    serviceSlugs: ["general-health-consultation", "family-medicine-visit", "blood-pressure-diabetes-check"],
  },
  {
    slug: "prakash-gurung",
    name: "Dr. Prakash Gurung",
    title: "Family Medicine Consultant (MD)",
    bio: "Family medicine consultant focused on long-term wellness, chronic condition follow-ups, and clear communication with patients.",
    experience: 12,
    specialty: "Clinics",
    imageUrl: IMG("photo-1622253692010-333f2da6031d"),
    serviceSlugs: ["family-medicine-visit", "pediatric-consultation", "blood-pressure-diabetes-check"],
  },

  // Dental Care (2)
  {
    slug: "suman-adhikari",
    name: "Dr. Suman Adhikari",
    title: "Dentist (BDS)",
    bio: "Dentist focused on preventive dentistry, gentle treatment, and clear oral health education for patients of all ages.",
    experience: 11,
    specialty: "Dental Care",
    imageUrl: IMG("photo-1612349317150-e413f6a5b16d"),
    serviceSlugs: ["dental-checkup-cleaning", "tooth-filling-consultation", "teeth-whitening-session"],
  },
  {
    slug: "nisha-bhandari",
    name: "Dr. Nisha Bhandari",
    title: "Dental Surgeon (BDS, MDS)",
    bio: "Dental surgeon with experience in restorative and orthodontic consultations, helping patients plan confident, healthy smiles.",
    experience: 8,
    specialty: "Dental Care",
    imageUrl: IMG("photo-1594824476967-48c8b964273f"),
    serviceSlugs: ["tooth-filling-consultation", "orthodontic-consultation", "dental-checkup-cleaning"],
  },

  // Salon & Beauty (2)
  {
    slug: "priya-karki",
    name: "Priya Karki",
    title: "Certified Beauty Specialist",
    bio: "Beauty professional offering hair, facial, and nail services with attention to hygiene, style, and client comfort.",
    experience: 7,
    specialty: "Salon & Beauty",
    imageUrl: IMG("photo-1580618672591-eb180b1a973f"),
    serviceSlugs: ["haircut-styling", "hair-coloring", "facial-treatment", "manicure-pedicure"],
  },
  {
    slug: "meera-tamang",
    name: "Meera Tamang",
    title: "Senior Hair & Skin Stylist",
    bio: "Senior stylist specializing in modern haircuts, color care, and rejuvenating facials tailored to individual preferences.",
    experience: 10,
    specialty: "Salon & Beauty",
    imageUrl: IMG("photo-1487412720507-e7ab37603c6f"),
    serviceSlugs: ["haircut-styling", "hair-coloring", "facial-treatment"],
  },

  // Massage & Spa (2)
  {
    slug: "ramesh-thapa",
    name: "Ramesh Thapa",
    title: "Licensed Massage Therapist",
    bio: "Massage therapist specializing in relaxation and deep tissue techniques to reduce stress, tension, and everyday fatigue.",
    experience: 8,
    specialty: "Massage & Spa",
    imageUrl: IMG("photo-1560250097-0b93528c311a"),
    serviceSlugs: ["full-body-massage", "relaxation-massage", "deep-tissue-massage"],
  },
  {
    slug: "sabin-lama",
    name: "Sabin Lama",
    title: "Spa & Wellness Therapist",
    bio: "Wellness therapist providing calming spa treatments and aromatherapy sessions designed for relaxation and recovery.",
    experience: 6,
    specialty: "Massage & Spa",
    imageUrl: IMG("photo-1506794778202-cad84cf45f1d"),
    serviceSlugs: ["aromatherapy-spa-session", "relaxation-massage", "full-body-massage"],
  },

  // Consultancy (1)
  {
    slug: "sita-rai",
    name: "Sita Rai",
    title: "Business Consultant (MBA)",
    bio: "Consultant helping individuals and businesses with practical planning, growth strategy, career direction, and decision support.",
    experience: 10,
    specialty: "Consultancy",
    imageUrl: IMG("photo-1573496359142-b8d87734a5a2"),
    serviceSlugs: ["business-consultation", "career-guidance", "startup-mentoring-session"],
  },
  {
    slug: "nabin-kc",
    name: "Nabin K.C.",
    title: "Financial & Career Advisor",
    bio: "Advisor supporting clients with personal financial planning, career development, and practical goal-based coaching.",
    experience: 7,
    specialty: "Consultancy",
    imageUrl: IMG("photo-1519085360753-af0119f7cbe7"),
    serviceSlugs: ["financial-planning-consultation", "career-guidance", "business-consultation"],
  },

  // Training & Education (2)
  {
    slug: "bikash-shrestha",
    name: "Bikash Shrestha",
    title: "IT Trainer (BSc CSIT)",
    bio: "IT trainer delivering hands-on computer, web development, and programming classes for beginners and growing learners.",
    experience: 6,
    specialty: "Training & Education",
    imageUrl: IMG("photo-1472099645785-5658abf4ff4e"),
    serviceSlugs: ["computer-training", "web-development-training", "programming-classes"],
  },
  {
    slug: "asmita-joshi",
    name: "Asmita Joshi",
    title: "Digital Skills Instructor",
    bio: "Instructor focused on practical digital skills, from computer fundamentals to online marketing basics for students and professionals.",
    experience: 5,
    specialty: "Training & Education",
    imageUrl: IMG("photo-1544005313-94ddf0286df2"),
    serviceSlugs: ["computer-training", "digital-marketing-training", "web-development-training"],
  },
];

const defaultSchedule = {
  days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  startTime: "09:00 AM",
  endTime: "05:00 PM",
  breakStart: "01:00 PM",
  breakEnd: "02:00 PM",
};

const scheduleOverrides = {
  "anisha-sharma": { endTime: "04:00 PM", breakStart: "12:30 PM", breakEnd: "01:30 PM" },
  "suman-adhikari": { days: ["Mon", "Tue", "Wed", "Thu", "Fri"], startTime: "10:00 AM", endTime: "04:00 PM" },
  "sita-rai": { days: ["Mon", "Wed", "Fri", "Sat"], startTime: "10:00 AM", endTime: "04:00 PM" },
  "ramesh-thapa": { days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sun"], endTime: "06:00 PM", breakStart: "02:00 PM", breakEnd: "03:00 PM" },
  "priya-karki": { days: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri"], startTime: "10:00 AM", endTime: "06:00 PM" },
  "bikash-shrestha": { days: ["Mon", "Tue", "Wed", "Thu", "Fri"], startTime: "11:00 AM", endTime: "06:00 PM", breakStart: "02:00 PM", breakEnd: "02:30 PM" },
  "nabin-kc": { days: ["Tue", "Wed", "Thu", "Fri", "Sat"], startTime: "10:00 AM", endTime: "05:00 PM" },
  "asmita-joshi": { days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], startTime: "09:30 AM", endTime: "05:30 PM" },
};

async function main() {
  const adminEmail = "admin@bookease.com";
  const adminPassword = "Admin@123";
  const adminHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { name: "Admin User", role: "ADMIN", passwordHash: adminHash },
    create: { name: "Admin User", email: adminEmail, passwordHash: adminHash, role: "ADMIN" },
  });

  // Upsert required categories (keeps operation idempotent). Existing unrelated categories are left untouched.
  for (const c of categories) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name },
      create: c,
    });
  }

  // Handle common legacy aliases from earlier seeds/data.
  const legacyServiceSlugAliases = {
    "business-consultation": ["business-consulting"],
    "career-guidance": ["career-counseling"],
    "dental-checkup-cleaning": ["dental-checkup"],
  };

  for (const s of services) {
    const category = await prisma.category.findUnique({ where: { slug: s.categorySlug } });
    if (!category) continue;
    const data = {
      name: s.name,
      description: s.description,
      categoryId: category.id,
      priceNpr: s.priceNpr,
      durationMins: s.durationMins,
      imageUrl: s.imageUrl,
      isActive: true,
      benefits: Array.isArray(s.benefits) ? s.benefits : [],
      rating: 5.0,
    };

    const aliases = [s.slug, ...(legacyServiceSlugAliases[s.slug] || [])];
    const existing = await prisma.service.findFirst({ where: { slug: { in: aliases } } });
    if (existing) {
      await prisma.service.update({
        where: { id: existing.id },
        data: { ...data, slug: s.slug },
      });
    } else {
      await prisma.service.create({ data: { slug: s.slug, ...data } });
    }
  }

  for (const sp of specialists) {
    const base = {
      name: sp.name,
      title: sp.title,
      bio: sp.bio || null,
      experience: sp.experience || 0,
      rating: 5.0,
      specialty: sp.specialty,
      imageUrl: sp.imageUrl,
      isActive: true,
    };

    const specialist = await prisma.specialist.upsert({
      where: { slug: sp.slug },
      update: base,
      create: { slug: sp.slug, ...base },
    });

    const sched = { ...defaultSchedule, ...(scheduleOverrides[sp.slug] || {}) };
    await prisma.workingHour.upsert({
      where: { specialistId: specialist.id },
      update: sched,
      create: { specialistId: specialist.id, ...sched },
    });

    // Rebuild assignments idempotently for this specialist.
    await prisma.specialistService.deleteMany({ where: { specialistId: specialist.id } });
    for (const svcSlug of sp.serviceSlugs) {
      const svc = await prisma.service.findUnique({ where: { slug: svcSlug } });
      if (svc) {
        await prisma.specialistService.create({ data: { specialistId: specialist.id, serviceId: svc.id } });
      }
    }
  }

  // Report canonical seeded counts (based on the required dataset).
  const requiredCategorySlugs = categories.map((c) => c.slug);
  const requiredServiceSlugs = services.map((s) => s.slug);
  const requiredSpecialistSlugs = specialists.map((s) => s.slug);

  const [cCount, sCount, spCount] = await Promise.all([
    prisma.category.count({ where: { slug: { in: requiredCategorySlugs } } }),
    prisma.service.count({ where: { slug: { in: requiredServiceSlugs } } }),
    prisma.specialist.count({ where: { slug: { in: requiredSpecialistSlugs } } }),
  ]);

  console.log("Seed complete (idempotent). No user accounts or appointments were deleted.");
  console.log(
    `Required dataset present: ${cCount} categories, ${sCount} services, ${spCount} specialists (with working hours upserted for each).`
  );
  console.log("Admin login:", adminEmail, "/", adminPassword);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
