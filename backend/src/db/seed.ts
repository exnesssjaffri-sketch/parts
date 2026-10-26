import { ensureDb, getDb, persistSync, prepare } from './index.js';
import { initDatabase } from './init.js';
import { config } from '../config/index.js';
import crypto from 'crypto';

function pkrsToPaisa(pkr: number): number {
  return Math.round(pkr * 100);
}

export async function seedDatabase(): Promise<void> {
  await ensureDb();
  const db = getDb();
  await initDatabase();

  console.log('Seeding database...');

  // Use the wrapper's get() — sql.js .get() returns array, use step()+getAsObject()
  const countStmt = prepare('SELECT COUNT(*) as c FROM categories');
  const countResult = countStmt.get();
  const categoryCount = (countResult as any)?.c ?? 0;
  if (categoryCount > 0) {
    console.log('Database already seeded, skipping.');
    return;
  }

  // === BEGIN TRANSACTION ===
  db.run('BEGIN');
  try {
    // === Categories ===
    const categories = [
      { name: 'Engine Parts', slug: 'engine-parts', description: 'Internal engine components, filters, belts, and gaskets', sort_order: 1 },
      { name: 'Brake System', slug: 'brake-system', description: 'Brake pads, rotors, calipers, and brake fluid', sort_order: 2 },
      { name: 'Suspension & Steering', slug: 'suspension-steering', description: 'Shocks, struts, control arms, tie rods, and steering components', sort_order: 3 },
      { name: 'Electrical Parts', slug: 'electrical-parts', description: 'Batteries, alternators, starters, sensors, and wiring', sort_order: 4 },
      { name: 'Filters', slug: 'filters', description: 'Oil, air, fuel, and cabin filters', sort_order: 5 },
      { name: 'Cooling System', slug: 'cooling-system', description: 'Radiators, water pumps, thermostats, and coolant', sort_order: 6 },
      { name: 'Transmission', slug: 'transmission', description: 'Clutches, gearboxes, CV joints, and transmission fluid', sort_order: 7 },
      { name: 'Body Parts', slug: 'body-parts', description: 'Bumpers, fenders, hoods, doors, and mirrors', sort_order: 8 },
      { name: 'Interior Accessories', slug: 'interior-accessories', description: 'Floor mats, seat covers, organizers, and trim', sort_order: 9 },
      { name: 'Exterior Accessories', slug: 'exterior-accessories', description: 'Roof racks, spoilers, lights, and protective gear', sort_order: 10 },
      { name: 'Oils & Fluids', slug: 'oils-fluids', description: 'Engine oil, transmission fluid, brake fluid, and coolant', sort_order: 11 },
      { name: 'Car Care', slug: 'car-care', description: 'Cleaning products, wax, polish, and detailing tools', sort_order: 12 },
    ];
    for (const cat of categories) {
      const p = prepare('INSERT OR IGNORE INTO categories (name, slug, description, sort_order, is_active) VALUES (?, ?, ?, ?, 1)');
      p.run([cat.name, cat.slug, cat.description, cat.sort_order]);
    }

    // === Brands ===
    const brands = [
      { name: 'Bosch', slug: 'bosch', description: 'Premium German automotive parts', website_url: 'https://bosch.com' },
      { name: 'Denso', slug: 'denso', description: 'Japanese OEM quality components', website_url: 'https://denso.com' },
      { name: 'NGK', slug: 'ngk', description: 'World leader in spark plugs and sensors', website_url: 'https://ngk.com' },
      { name: 'Mann-Filter', slug: 'mann-filter', description: 'German filtration technology', website_url: 'https://mann-filter.com' },
      { name: 'Brembo', slug: 'brembo', description: 'Italian high-performance brake systems', website_url: 'https://brembo.com' },
      { name: 'ACDelco', slug: 'acdelco', description: 'General Motors genuine parts', website_url: 'https://acdelco.com' },
      { name: 'Febi Bilstein', slug: 'febi-bilstein', description: 'German quality replacement parts', website_url: 'https://febi.com' },
      { name: 'Lemforder', slug: 'lemforder', description: 'Steering and suspension specialist', website_url: 'https://lemforder.com' },
      { name: 'Gates', slug: 'gates', description: 'Belts, hoses, and tensioners', website_url: 'https://gates.com' },
      { name: 'Mahle', slug: 'mahle', description: 'Engine components and filtration', website_url: 'https://mahle.com' },
      { name: 'KYB', slug: 'kyb', description: 'Japanese shock absorbers and struts', website_url: 'https://kyb.com' },
      { name: 'Valeo', slug: 'valeo', description: 'French automotive technology', website_url: 'https://valeo.com' },
      { name: 'TRW', slug: 'trw', description: 'Brake and steering systems', website_url: 'https://trw.com' },
      { name: 'Monroe', slug: 'monroe', description: 'Shock absorbers and suspension', website_url: 'https://monroe.com' },
      { name: 'Exide', slug: 'exide', description: 'Automotive batteries', website_url: 'https://exide.com' },
      { name: 'Shell', slug: 'shell', description: 'Petroleum and lubricants', website_url: 'https://shell.com' },
      { name: 'Total', slug: 'total', description: 'French lubricants and automotive solutions', website_url: 'https://total.com' },
      { name: 'Castrol', slug: 'castrol', description: 'British lubricants and fluids', website_url: 'https://castrol.com' },
      { name: 'Meguiars', slug: 'meguiars', description: 'Premium car care products', website_url: 'https://meguiars.com' },
      { name: 'Aftermarket', slug: 'aftermarket', description: 'Aftermarket and compatible parts', website_url: '' },
    ];
    for (const brand of brands) {
      const p = prepare('INSERT OR IGNORE INTO brands (name, slug, description, website_url, is_active) VALUES (?, ?, ?, ?, 1)');
      p.run([brand.name, brand.slug, brand.description, brand.website_url]);
    }

    // === Vehicle Makes ===
    const makes = [
      { name: 'Toyota', slug: 'toyota' },
      { name: 'Honda', slug: 'honda' },
      { name: 'Suzuki', slug: 'suzuki' },
      { name: 'Hyundai', slug: 'hyundai' },
      { name: 'Kia', slug: 'kia' },
      { name: 'Mitsubishi', slug: 'mitsubishi' },
      { name: 'Daihatsu', slug: 'daihatsu' },
      { name: 'FAW', slug: 'faw' },
      { name: 'MG', slug: 'mg' },
      { name: 'Chery', slug: 'chery' },
      { name: 'Proton', slug: 'proton' },
      { name: 'Nissan', slug: 'nissan' },
      { name: 'Mazda', slug: 'mazda' },
      { name: 'Subaru', slug: 'subaru' },
      { name: 'Isuzu', slug: 'isuzu' },
    ];
    for (const make of makes) {
      const p = prepare('INSERT OR IGNORE INTO vehicle_makes (name, slug, is_active) VALUES (?, ?, 1)');
      p.run([make.name, make.slug]);
    }

    // === Vehicle Models & Variants ===
    const vehicleData: Record<string, Array<{ name: string; slug: string; variants: Array<{ year: number; engine: string; transmission?: string; fuel_type?: string; body_type?: string }> }>> = {
      toyota: [
        { name: 'Corolla', slug: 'corolla', variants: [
          { year: 2020, engine: '1.6L 1ZR-FE', transmission: 'CVT', fuel_type: 'Petrol', body_type: 'Sedan' },
          { year: 2019, engine: '1.8L 2ZR-FE', transmission: 'CVT', fuel_type: 'Petrol', body_type: 'Sedan' },
          { year: 2018, engine: '1.6L 1ZR-FE', transmission: 'Manual', fuel_type: 'Petrol', body_type: 'Sedan' },
          { year: 2017, engine: '1.3L 1NR-FE', transmission: 'Manual', fuel_type: 'Petrol', body_type: 'Sedan' },
        ]},
        { name: 'Yaris', slug: 'yaris', variants: [
          { year: 2022, engine: '1.5L 2NR-FE', transmission: 'CVT', fuel_type: 'Petrol', body_type: 'Hatchback' },
          { year: 2021, engine: '1.3L 1NR-FE', transmission: 'Manual', fuel_type: 'Petrol', body_type: 'Hatchback' },
        ]},
        { name: 'Fortuner', slug: 'fortuner', variants: [
          { year: 2022, engine: '2.8L 1GD-FTV', transmission: 'Auto', fuel_type: 'Diesel', body_type: 'SUV' },
          { year: 2020, engine: '2.7L 2TR-FE', transmission: 'Auto', fuel_type: 'Petrol', body_type: 'SUV' },
        ]},
        { name: 'Hilux', slug: 'hilux', variants: [
          { year: 2021, engine: '2.8L 1GD-FTV', transmission: 'Manual', fuel_type: 'Diesel', body_type: 'Pickup' },
          { year: 2019, engine: '2.4L 2GD-FTV', transmission: 'Auto', fuel_type: 'Diesel', body_type: 'Pickup' },
        ]},
      ],
      honda: [
        { name: 'Civic', slug: 'civic', variants: [
          { year: 2022, engine: '1.5L L15B7 Turbo', transmission: 'CVT', fuel_type: 'Petrol', body_type: 'Sedan' },
          { year: 2020, engine: '1.5L L15B7 Turbo', transmission: 'CVT', fuel_type: 'Petrol', body_type: 'Sedan' },
          { year: 2018, engine: '1.8L R18Z1', transmission: 'CVT', fuel_type: 'Petrol', body_type: 'Sedan' },
        ]},
        { name: 'City', slug: 'city', variants: [
          { year: 2022, engine: '1.5L L15Z1', transmission: 'CVT', fuel_type: 'Petrol', body_type: 'Sedan' },
          { year: 2020, engine: '1.5L L15Z1', transmission: 'Manual', fuel_type: 'Petrol', body_type: 'Sedan' },
        ]},
        { name: 'BR-V', slug: 'br-v', variants: [
          { year: 2020, engine: '1.5L L15Z1', transmission: 'CVT', fuel_type: 'Petrol', body_type: 'SUV' },
        ]},
      ],
      suzuki: [
        { name: 'Cultus', slug: 'cultus', variants: [
          { year: 2022, engine: '1.0L K10C', transmission: 'Manual', fuel_type: 'Petrol', body_type: 'Hatchback' },
          { year: 2020, engine: '1.0L K10B', transmission: 'Manual', fuel_type: 'Petrol', body_type: 'Hatchback' },
        ]},
        { name: 'Swift', slug: 'swift', variants: [
          { year: 2021, engine: '1.2L K12M', transmission: 'Manual', fuel_type: 'Petrol', body_type: 'Hatchback' },
          { year: 2019, engine: '1.2L K12M', transmission: 'Auto', fuel_type: 'Petrol', body_type: 'Hatchback' },
        ]},
        { name: 'Wagon R', slug: 'wagon-r', variants: [
          { year: 2022, engine: '1.0L K10C', transmission: 'Manual', fuel_type: 'Petrol', body_type: 'Hatchback' },
        ]},
        { name: 'Alto', slug: 'alto', variants: [
          { year: 2022, engine: '0.66L R06A', transmission: 'Manual', fuel_type: 'Petrol', body_type: 'Hatchback' },
        ]},
      ],
      hyundai: [
        { name: 'Elantra', slug: 'elantra', variants: [
          { year: 2022, engine: '2.0L Nu', transmission: 'Auto', fuel_type: 'Petrol', body_type: 'Sedan' },
          { year: 2020, engine: '1.6L Gamma', transmission: 'Auto', fuel_type: 'Petrol', body_type: 'Sedan' },
        ]},
        { name: 'Tucson', slug: 'tucson', variants: [
          { year: 2022, engine: '2.0L Nu', transmission: 'Auto', fuel_type: 'Petrol', body_type: 'SUV' },
        ]},
      ],
      kia: [
        { name: 'Sportage', slug: 'sportage', variants: [
          { year: 2022, engine: '2.0L Nu', transmission: 'Auto', fuel_type: 'Petrol', body_type: 'SUV' },
        ]},
        { name: 'Picanto', slug: 'picanto', variants: [
          { year: 2022, engine: '1.0L Kappa', transmission: 'Manual', fuel_type: 'Petrol', body_type: 'Hatchback' },
        ]},
      ],
    };

    const insertModel = prepare('INSERT OR IGNORE INTO vehicle_models (make_id, name, slug, is_active) VALUES (?, ?, ?, 1)');
    const insertVariant = prepare('INSERT OR IGNORE INTO vehicle_variants (model_id, year, engine, transmission, fuel_type, body_type, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)');

    for (const [makeSlug, models] of Object.entries(vehicleData)) {
      const makeRow = prepare('SELECT id FROM vehicle_makes WHERE slug = ?').get(makeSlug) as { id: number } | undefined;
      if (!makeRow) continue;
      for (const model of models) {
        insertModel.run([makeRow.id, model.name, model.slug]);
        const modelRow = prepare('SELECT id FROM vehicle_models WHERE make_id = ? AND slug = ?').get(makeRow.id, model.slug) as { id: number } | undefined;
        if (!modelRow) continue;
        for (const variant of model.variants) {
          insertVariant.run([modelRow.id, variant.year, variant.engine, variant.transmission || null, variant.fuel_type || null, variant.body_type || null]);
        }
      }
    }

    // === Get variant IDs for product compatibility ===
    const variantRows = prepare('SELECT id FROM vehicle_variants WHERE model_id IN (SELECT id FROM vehicle_models WHERE make_id IN (SELECT id FROM vehicle_makes)) LIMIT 100').all() as { id: number }[];
    const variantMap = new Map<number, number>();
    variantRows.forEach((v, i) => variantMap.set(i, v.id));

    // === Products ===
    const insertProduct = prepare('INSERT OR IGNORE INTO products (sku, name, slug, description, short_description, price, sale_price, stock_quantity, low_stock_threshold, weight_grams, condition, warranty_months, category_id, brand_id, is_active, is_featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)');
    const insertImage = prepare('INSERT OR IGNORE INTO product_images (product_id, url, alt_text, sort_order, is_primary) VALUES (?, ?, ?, ?, ?)');
    const insertSpec = prepare('INSERT OR IGNORE INTO product_specifications (product_id, spec_key, spec_value, sort_order) VALUES (?, ?, ?, ?)');
    const insertCompat = prepare('INSERT OR IGNORE INTO product_vehicle_compatibility (product_id, variant_id, verified) VALUES (?, ?, 1)');

    const products: Array<{
      sku: string; name: string; slug: string; description: string; short_description: string;
      price: number; sale_price: number | null; stock_quantity: number; low_stock_threshold: number;
      weight_grams: number | null; condition: string; warranty_months: number | null;
      category_slug: string; brand_slug: string; is_featured: number;
      specs: Record<string, string>; compat_variant_indices: number[] | null;
    }> = [
      {
        sku: 'BP-ENG-001', name: 'Bosch Spark Plug Set (4pcs) - Toyota Corolla 1.6L/1.8L',
        slug: 'bosch-spark-plug-set-toyota-corolla',
        description: 'Genuine Bosch platinum spark plugs for Toyota Corolla 1.6L and 1.8L engines (2014-2022). Improved ignition performance, better fuel economy, and longer service life. Set of 4 plugs.',
        short_description: 'Bosch platinum spark plugs for Corolla 1.6L/1.8L (4pcs)',
        price: pkrsToPaisa(4500), sale_price: pkrsToPaisa(3800), stock_quantity: 50,
        low_stock_threshold: 10, weight_grams: 200, condition: 'new', warranty_months: 12,
        category_slug: 'engine-parts', brand_slug: 'bosch', is_featured: 1,
        specs: { 'Thread Size': 'M12 x 1.25', 'Reach': '26.5mm', 'Hex Size': '16mm (5/8")', 'Gap': '1.1mm (pre-gapped)', 'Electrode Material': 'Platinum', 'Heat Range': '6' },
        compat_variant_indices: [0, 1, 2, 3],
      },
      {
        sku: 'BP-ENG-002', name: 'NGK Iridium Spark Plug - Honda Civic 1.5L Turbo',
        slug: 'ngk-iridium-spark-plug-honda-civic',
        description: 'NGK Laser Iridium spark plug for Honda Civic 1.5L Turbo (2016+). Fine wire iridium center electrode for superior ignitability and durability. Sold individually.',
        short_description: 'NGK Laser Iridium spark plug for Civic 1.5L Turbo',
        price: pkrsToPaisa(1800), sale_price: null, stock_quantity: 80,
        low_stock_threshold: 15, weight_grams: 60, condition: 'new', warranty_months: 12,
        category_slug: 'engine-parts', brand_slug: 'ngk', is_featured: 1,
        specs: { 'Thread Size': 'M12 x 1.25', 'Reach': '26.5mm', 'Hex Size': '16mm (5/8")', 'Gap': '0.8mm (pre-gapped)', 'Center Electrode': 'Iridium', 'Ground Electrode': 'Platinum' },
        compat_variant_indices: [4, 5, 6],
      },
      {
        sku: 'BP-ENG-003', name: 'Gates Timing Belt Kit - Suzuki Cultus 1.0L',
        slug: 'gates-timing-belt-kit-suzuki-cultus',
        description: 'Complete Gates timing belt kit for Suzuki Cultus 1.0L (K10B/K10C). Includes timing belt, tensioner pulley, and idler pulley. OEM quality, quiet operation.',
        short_description: 'Gates timing belt kit with tensioner for Cultus 1.0L',
        price: pkrsToPaisa(3200), sale_price: pkrsToPaisa(2800), stock_quantity: 35,
        low_stock_threshold: 8, weight_grams: 800, condition: 'new', warranty_months: 24,
        category_slug: 'engine-parts', brand_slug: 'gates', is_featured: 0,
        specs: { 'Belt Type': 'Timing Belt', 'Material': 'HSN (Highly Saturated Nitrite)', 'Tensioner': 'Hydraulic/Mechanical', 'Includes': 'Belt, Tensioner, Idler Pulley' },
        compat_variant_indices: [8, 9],
      },
      {
        sku: 'BP-ENG-004', name: 'Mann-Filter Engine Oil Filter - Universal Fit',
        slug: 'mann-filter-oil-filter-universal',
        description: 'Mann-Filter premium oil filter compatible with Toyota, Honda, Suzuki models. High dirt holding capacity, synthetic media. Check compatibility before ordering.',
        short_description: 'Mann-Filter premium oil filter (check fitment)',
        price: pkrsToPaisa(850), sale_price: null, stock_quantity: 120,
        low_stock_threshold: 20, weight_grams: 350, condition: 'new', warranty_months: 6,
        category_slug: 'filters', brand_slug: 'mann-filter', is_featured: 1,
        specs: { 'Filter Media': 'Synthetic', 'Efficiency': '99.9% @ 20 microns', 'Thread': '3/4"-16 UNF', 'Gasket': 'Nitrile' },
        compat_variant_indices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      },
      {
        sku: 'BP-BRK-001', name: 'Brembo Front Brake Pad Set - Toyota Corolla (2014-2022)',
        slug: 'brembo-front-brake-pads-corolla',
        description: 'Brembo NAO ceramic front brake pads for Toyota Corolla 2014-2022. Low dust, quiet operation, excellent stopping power. Set includes 4 pads with hardware.',
        short_description: 'Brembo ceramic front brake pads for Corolla 2014-2022',
        price: pkrsToPaisa(6500), sale_price: pkrsToPaisa(5500), stock_quantity: 40,
        low_stock_threshold: 10, weight_grams: 1500, condition: 'new', warranty_months: 24,
        category_slug: 'brake-system', brand_slug: 'brembo', is_featured: 1,
        specs: { 'Material': 'Ceramic (NAO)', 'Position': 'Front', 'Pad Thickness': '16mm', 'Includes': '4 pads, shims, wear sensors', 'Dust Level': 'Very Low' },
        compat_variant_indices: [0, 1, 2, 3],
      },
      {
        sku: 'BP-BRK-002', name: 'TRW Rear Brake Pad Set - Honda Civic (2016-2022)',
        slug: 'trw-rear-brake-pads-civic',
        description: 'TRW premium rear brake pads for Honda Civic 10th/11th Gen. Semi-metallic compound for balanced performance and wear. Includes hardware kit.',
        short_description: 'TRW semi-metallic rear brake pads for Civic 2016+',
        price: pkrsToPaisa(4200), sale_price: null, stock_quantity: 45,
        low_stock_threshold: 10, weight_grams: 1200, condition: 'new', warranty_months: 24,
        category_slug: 'brake-system', brand_slug: 'trw', is_featured: 0,
        specs: { 'Material': 'Semi-Metallic', 'Position': 'Rear', 'Pad Thickness': '14mm', 'Includes': '4 pads, shims, clips' },
        compat_variant_indices: [4, 5, 6],
      },
      {
        sku: 'BP-BRK-003', name: 'Brembo Brake Disc Rotor (Pair) - Suzuki Swift Front',
        slug: 'brembo-brake-rotor-swift-front',
        description: 'Brembo ventilated front brake disc rotors for Suzuki Swift (2017+). High carbon cast iron, precision machined, corrosion-resistant coating.',
        short_description: 'Brembo ventilated front rotors for Swift (pair)',
        price: pkrsToPaisa(8500), sale_price: null, stock_quantity: 25,
        low_stock_threshold: 5, weight_grams: 9000, condition: 'new', warranty_months: 36,
        category_slug: 'brake-system', brand_slug: 'brembo', is_featured: 0,
        specs: { 'Type': 'Ventilated', 'Diameter': '262mm', 'Thickness': '22mm', 'Material': 'High Carbon Cast Iron', 'Coating': 'Anti-corrosion', 'Sold As': 'Pair (2 rotors)' },
        compat_variant_indices: [10, 11],
      },
      {
        sku: 'BP-SUS-001', name: 'KYB Excel-G Front Shock Absorber (Pair) - Toyota Corolla',
        slug: 'kyb-excel-g-front-shocks-corolla',
        description: 'KYB Excel-G twin-tube gas front shock absorbers for Toyota Corolla 2014-2022. Restores original ride quality and handling. Sold as pair.',
        short_description: 'KYB Excel-G front shocks for Corolla (pair)',
        price: pkrsToPaisa(12500), sale_price: null, stock_quantity: 20,
        low_stock_threshold: 5, weight_grams: 6000, condition: 'new', warranty_months: 36,
        category_slug: 'suspension-steering', brand_slug: 'kyb', is_featured: 1,
        specs: { 'Type': 'Twin-Tube Gas', 'Position': 'Front', 'Sold As': 'Pair (2 shocks)', 'Mounting': 'Original Spec' },
        compat_variant_indices: [0, 1, 2, 3],
      },
      {
        sku: 'BP-SUS-002', name: 'Lemforder Tie Rod End - Honda City (2014-2021)',
        slug: 'lemforder-tie-rod-end-city',
        description: 'Lemforder outer tie rod end for Honda City 2014-2021. Precision ball joint, sealed for life, direct OE replacement.',
        short_description: 'Lemforder outer tie rod end for City 2014-2021',
        price: pkrsToPaisa(2800), sale_price: null, stock_quantity: 60,
        low_stock_threshold: 12, weight_grams: 450, condition: 'new', warranty_months: 24,
        category_slug: 'suspension-steering', brand_slug: 'lemforder', is_featured: 0,
        specs: { 'Position': 'Outer Tie Rod End', 'Thread': 'M14 x 1.5', 'Boot Material': 'Neoprene', 'Grease': 'Lifetime Sealed' },
        compat_variant_indices: [7, 8],
      },
      {
        sku: 'BP-FLT-001', name: 'Mann-Filter Air Filter - Toyota Corolla 1.6L/1.8L',
        slug: 'mann-filter-air-filter-corolla',
        description: 'Mann-Filter high-flow air filter for Toyota Corolla 1.6L/1.8L (2014-2022). Synthetic media, 99.9% efficiency, longer service intervals.',
        short_description: 'Mann-Filter synthetic air filter for Corolla',
        price: pkrsToPaisa(1650), sale_price: pkrsToPaisa(1350), stock_quantity: 70,
        low_stock_threshold: 15, weight_grams: 400, condition: 'new', warranty_months: 12,
        category_slug: 'filters', brand_slug: 'mann-filter', is_featured: 0,
        specs: { 'Media': 'Synthetic', 'Efficiency': '99.9%', 'Flow Rate': 'High' },
        compat_variant_indices: [0, 1, 2, 3],
      },
      {
        sku: 'BP-FLT-002', name: 'Bosch Cabin Filter Activated Carbon - Honda Civic',
        slug: 'bosch-cabin-filter-civic',
        description: 'Bosch activated carbon cabin filter for Honda Civic 2016+. Traps dust, pollen, odors, and harmful gases. Replace every 15,000km.',
        short_description: 'Bosch activated carbon cabin filter for Civic',
        price: pkrsToPaisa(1200), sale_price: null, stock_quantity: 85,
        low_stock_threshold: 15, weight_grams: 250, condition: 'new', warranty_months: 12,
        category_slug: 'filters', brand_slug: 'bosch', is_featured: 0,
        specs: { 'Type': 'Activated Carbon', 'Filtration': 'Particles, Odors, Gases', 'Replacement Interval': '15,000 km' },
        compat_variant_indices: [4, 5, 6],
      },
      {
        sku: 'BP-FLT-003', name: 'Denso Fuel Filter - Suzuki Swift/Wagon R',
        slug: 'denso-fuel-filter-swift-wagonr',
        description: 'Denso in-line fuel filter for Suzuki Swift and Wagon R. High filtration efficiency protects injectors and engine.',
        short_description: 'Denso in-line fuel filter for Swift/Wagon R',
        price: pkrsToPaisa(950), sale_price: null, stock_quantity: 55,
        low_stock_threshold: 10, weight_grams: 180, condition: 'new', warranty_months: 12,
        category_slug: 'filters', brand_slug: 'denso', is_featured: 0,
        specs: { 'Type': 'In-Line', 'Filtration': '10 microns', 'Connection': 'Quick Connect' },
        compat_variant_indices: [10, 11, 12, 13],
      },
      {
        sku: 'BP-COL-001', name: 'Valeo Radiator - Toyota Corolla 1.6L/1.8L (2014-2022)',
        slug: 'valeo-radiator-corolla',
        description: 'Valeo aluminum/plastic radiator for Toyota Corolla 2014-2022. OE fit, pressure tested, includes drain plug and caps.',
        short_description: 'Valeo radiator for Corolla 2014-2022',
        price: pkrsToPaisa(14500), sale_price: null, stock_quantity: 15,
        low_stock_threshold: 3, weight_grams: 4500, condition: 'new', warranty_months: 24,
        category_slug: 'cooling-system', brand_slug: 'valeo', is_featured: 0,
        specs: { 'Core': 'Aluminum', 'Tanks': 'Reinforced Plastic', 'Includes': 'Drain Plug, Caps', 'Test Pressure': '1.2 bar' },
        compat_variant_indices: [0, 1, 2, 3],
      },
      {
        sku: 'BP-COL-002', name: 'Gates Water Pump - Honda City 1.5L',
        slug: 'gates-water-pump-city',
        description: 'Gates water pump with gasket for Honda City 1.5L (2014-2021). Precision bearing, ceramic seal, OE quality.',
        short_description: 'Gates water pump with gasket for City 1.5L',
        price: pkrsToPaisa(3800), sale_price: null, stock_quantity: 30,
        low_stock_threshold: 6, weight_grams: 1800, condition: 'new', warranty_months: 24,
        category_slug: 'cooling-system', brand_slug: 'gates', is_featured: 0,
        specs: { 'Seal': 'Ceramic Mechanical Seal', 'Bearing': 'Precision Ball Bearing', 'Includes': 'Gasket' },
        compat_variant_indices: [7, 8],
      },
      {
        sku: 'BP-ELE-001', name: 'Exide AGM Battery DIN66 - 70Ah (Toyota/Honda/Suzuki)',
        slug: 'exide-agm-battery-din66-70ah',
        description: 'Exide AGM start-stop battery DIN66 70Ah 760CCA. Maintenance-free, vibration resistant, suitable for modern vehicles with start-stop. Fits Corolla, Civic, Swift, and many others.',
        short_description: 'Exide AGM 70Ah 760CCA battery (DIN66)',
        price: pkrsToPaisa(18500), sale_price: pkrsToPaisa(16500), stock_quantity: 25,
        low_stock_threshold: 5, weight_grams: 21000, condition: 'new', warranty_months: 36,
        category_slug: 'electrical-parts', brand_slug: 'exide', is_featured: 1,
        specs: { 'Type': 'AGM (Absorbent Glass Mat)', 'Capacity': '70Ah', 'CCA': '760A', 'Standard': 'DIN66 (L3)', 'Terminal': 'Right Positive', 'Maintenance': 'Free' },
        compat_variant_indices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
      },
      {
        sku: 'BP-ELE-002', name: 'Denso Alternator - Toyota Corolla 1.8L (2014-2019)',
        slug: 'denso-alternator-corolla',
        description: 'Denso remanufactured alternator for Toyota Corolla 1.8L 2014-2019. 100A output, tested to OE specs, 1-year warranty.',
        short_description: 'Denso 100A reman alternator for Corolla 1.8L',
        price: pkrsToPaisa(16500), sale_price: null, stock_quantity: 12,
        low_stock_threshold: 3, weight_grams: 5500, condition: 'refurbished', warranty_months: 12,
        category_slug: 'electrical-parts', brand_slug: 'denso', is_featured: 0,
        specs: { 'Output': '100A / 12V', 'Pulley': '6-Groove Serpentine', 'Regulator': 'Internal', 'Condition': 'Remanufactured' },
        compat_variant_indices: [1],
      },
      {
        sku: 'BP-OIL-001', name: 'Shell Helix Ultra 5W-40 Full Synthetic - 4L',
        slug: 'shell-helix-ultra-5w40-4l',
        description: 'Shell Helix Ultra 5W-40 fully synthetic engine oil. PurePlus Technology, superior sludge protection, meets API SN/CF, ACEA A3/B4. 4-liter pack.',
        short_description: 'Shell Helix Ultra 5W-40 full synthetic 4L',
        price: pkrsToPaisa(4800), sale_price: pkrsToPaisa(4200), stock_quantity: 100,
        low_stock_threshold: 20, weight_grams: 3800, condition: 'new', warranty_months: 24,
        category_slug: 'oils-fluids', brand_slug: 'shell', is_featured: 1,
        specs: { 'Viscosity': '5W-40', 'Type': 'Full Synthetic', 'Volume': '4 Liters', 'Standards': 'API SN/CF, ACEA A3/B4', 'Technology': 'PurePlus' },
        compat_variant_indices: null,
      },
      {
        sku: 'BP-OIL-002', name: 'Total Quartz 9000 5W-30 - 4L',
        slug: 'total-quartz-9000-5w30-4l',
        description: 'Total Quartz 9000 Energy 5W-30 synthetic oil. Fuel economy formula, Age Resistance Technology. API SN, ACEA C2/C3. 4-liter pack.',
        short_description: 'Total Quartz 9000 5W-30 synthetic 4L',
        price: pkrsToPaisa(4500), sale_price: null, stock_quantity: 80,
        low_stock_threshold: 15, weight_grams: 3800, condition: 'new', warranty_months: 24,
        category_slug: 'oils-fluids', brand_slug: 'total', is_featured: 0,
        specs: { 'Viscosity': '5W-30', 'Type': 'Synthetic', 'Volume': '4 Liters', 'Standards': 'API SN, ACEA C2/C3', 'Technology': 'Age Resistance' },
        compat_variant_indices: null,
      },
      {
        sku: 'BP-OIL-003', name: 'Castrol Brake Fluid DOT 4 - 500ml',
        slug: 'castrol-brake-fluid-dot4-500ml',
        description: 'Castrol React SRF DOT 4 brake fluid. High boiling point (310°C dry / 200°C wet), suitable for ABS/ESP systems. 500ml bottle.',
        short_description: 'Castrol DOT 4 brake fluid 500ml',
        price: pkrsToPaisa(850), sale_price: null, stock_quantity: 120,
        low_stock_threshold: 25, weight_grams: 550, condition: 'new', warranty_months: 24,
        category_slug: 'oils-fluids', brand_slug: 'castrol', is_featured: 0,
        specs: { 'Standard': 'DOT 4', 'Dry Boiling Point': '310°C', 'Wet Boiling Point': '200°C', 'Volume': '500ml', 'Compatibility': 'ABS/ESP' },
        compat_variant_indices: null,
      },
      {
        sku: 'BP-BDY-001', name: 'Front Bumper - Toyota Corolla 2017-2019 (Unpainted)',
        slug: 'front-bumper-corolla-2017-2019',
        description: 'Replacement front bumper cover for Toyota Corolla 2017-2019. Unpainted (primed), CAPA certified, includes mounting points for fog lights and sensors.',
        short_description: 'Unpainted front bumper for Corolla 2017-2019',
        price: pkrsToPaisa(12500), sale_price: null, stock_quantity: 8,
        low_stock_threshold: 2, weight_grams: 3500, condition: 'new', warranty_months: 12,
        category_slug: 'body-parts', brand_slug: 'aftermarket', is_featured: 0,
        specs: { 'Material': 'PP (Polypropylene)', 'Finish': 'Primed (Unpainted)', 'Certification': 'CAPA Certified', 'Includes': 'Fog Light Mounts, Sensor Holes' },
        compat_variant_indices: [2, 3],
      },
      {
        sku: 'BP-INT-001', name: '3D Custom Fit Floor Mats - Honda Civic (2016-2022)',
        slug: '3d-floor-mats-civic',
        description: 'Laser-measured 3D floor mats for Honda Civic 10th/11th Gen. TPE material, odorless, waterproof, easy clean. Set of 4 (front + rear).',
        short_description: '3D TPE floor mats for Civic 2016-2022 (set of 4)',
        price: pkrsToPaisa(4500), sale_price: pkrsToPaisa(3800), stock_quantity: 40,
        low_stock_threshold: 8, weight_grams: 2500, condition: 'new', warranty_months: 12,
        category_slug: 'interior-accessories', brand_slug: 'aftermarket', is_featured: 1,
        specs: { 'Material': 'TPE (Thermoplastic Elastomer)', 'Coverage': 'Full Floor (4 pcs)', 'Features': 'Waterproof, Odorless, Easy Clean', 'Fitment': 'Laser Measured' },
        compat_variant_indices: [4, 5, 6],
      },
      {
        sku: 'BP-CAR-001', name: 'Meguiars Ultimate Liquid Wax - 473ml',
        slug: 'meguiars-ultimate-liquid-wax',
        description: 'Meguiars Ultimate Liquid Wax with ThinFilm Technology. Easy application, deep gloss, hydrophobic protection. Lasts up to 6 months. 473ml bottle.',
        short_description: 'Meguiars Ultimate Liquid Wax 473ml',
        price: pkrsToPaisa(2200), sale_price: null, stock_quantity: 60,
        low_stock_threshold: 12, weight_grams: 500, condition: 'new', warranty_months: 24,
        category_slug: 'car-care', brand_slug: 'meguiars', is_featured: 0,
        specs: { 'Type': 'Synthetic Polymer Wax', 'Technology': 'ThinFilm', 'Durability': 'Up to 6 months', 'Volume': '473ml', 'Application': 'Hand or Machine' },
        compat_variant_indices: null,
      },
    ];

    for (const prod of products) {
      const cat = prepare('SELECT id FROM categories WHERE slug = ?').get(prod.category_slug) as { id: number } | undefined;
      const brand = prepare('SELECT id FROM brands WHERE slug = ?').get(prod.brand_slug) as { id: number } | undefined;
      if (!cat) {
        console.warn(`Category not found: ${prod.category_slug} for product ${prod.sku}`);
        continue;
      }
      const result = insertProduct.run([prod.sku, prod.name, prod.slug, prod.description, prod.short_description, prod.price, prod.sale_price, prod.stock_quantity, prod.low_stock_threshold, prod.weight_grams, prod.condition, prod.warranty_months, cat.id, brand?.id ?? null, prod.is_featured]);
      const productId = result.lastInsertRowid as number;

      insertImage.run([productId, `https://via.placeholder.com/600x600/1c1917/fafafa?text=${encodeURIComponent(prod.name)}`, prod.name, 0, 1]);

      if (prod.specs) {
        let sortOrder = 0;
        for (const [key, value] of Object.entries(prod.specs)) {
          insertSpec.run([productId, key, value, sortOrder++]);
        }
      }

      if (prod.compat_variant_indices) {
        for (const idx of prod.compat_variant_indices) {
          if (variantMap.has(idx)) {
            insertCompat.run([productId, variantMap.get(idx)!]);
          }
        }
      }
    }

    // === Coupons ===
    const insertCoupon = prepare('INSERT OR IGNORE INTO coupons (code, description, discount_type, discount_value, min_order_amount, max_discount_amount, usage_limit, user_limit, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)');
    insertCoupon.run(['WELCOME10', 'Welcome 10% off first order', 'percentage', 10, pkrsToPaisa(1000), pkrsToPaisa(1000), 1000, 1]);
    insertCoupon.run(['SAVE500', 'Flat Rs. 500 off orders over Rs. 3000', 'fixed', pkrsToPaisa(500), pkrsToPaisa(3000), null, 500, 1]);
    insertCoupon.run(['FREESHIP', 'Free delivery on any order', 'fixed', pkrsToPaisa(250), 0, pkrsToPaisa(250), 200, 1]);

    // === Admin User ===
    const adminPassword = config.admin.password;
    const adminSalt = crypto.randomBytes(16).toString('hex');
    const adminHash = crypto.pbkdf2Sync(adminPassword, adminSalt, 100000, 32, 'sha256').toString('hex');
    const passwordHash = `${adminSalt}:${adminHash}`;
    const insertUser = prepare('INSERT OR IGNORE INTO users (email, password_hash, first_name, last_name, is_admin, is_active, email_verified) VALUES (?, ?, ?, ?, 1, 1, 1)');
    insertUser.run([config.admin.email, passwordHash, 'Admin', 'User']);

    db.run('COMMIT');
    persistSync();
    console.log('Database seeded successfully!');
  } catch (e) {
    try { db.run('ROLLBACK'); } catch (_) { /* no-op */ }
    throw e;
  }
}

// CLI entry point — only run if executed directly, not when imported
const isMainModule = process.argv[1] && (process.argv[1].endsWith('seed.ts') || process.argv[1].endsWith('seed.js'));
if (isMainModule) {
  seedDatabase().catch(console.error);
}
