import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import { ProductCard } from '../components/ProductCard';
import { VehicleFinder } from '../components/VehicleFinder';
import { Product, Category, Brand } from '../types';

export const Home: React.FC = () => {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [featuredRes, categoriesRes, brandsRes] = await Promise.all([
          api.getFeaturedProducts(),
          api.getCategories(),
          api.getBrands(),
        ]);
        setFeaturedProducts(featuredRes);
        setCategories(categoriesRes);
        setBrands(brandsRes);
      } catch (err: any) {
        setError(err.message || 'Failed to load home data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-charcoal-900 mb-8">AutoMarts</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg p-4 border border-neutral-border animate-pulse">
                <div className="h-24 w-full bg-charcoal-100 rounded-lg mb-3" />
                <h3 className="h-6 w-40 bg-charcoal-100 rounded mb-2" />
                <p className="h-4 w-32 bg-charcoal-100 rounded mb-2" />
                <div className="flex items-center space-x-2">
                  <span className="h-4 w-4 bg-charcoal-100 rounded-full" />
                  <span className="h-4 w-20 bg-charcoal-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <HeaderSection />
      <FeaturedProductsSection products={featuredProducts} />
      <CategoriesSection categories={categories} />
      <BrandsSection brands={brands} />
      <VehicleFinder />
    </div>
  );
};

const HeaderSection: React.FC = () => {
  return (
    <section className="py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-charcoal-900 mb-4">
            Premium Auto Parts for Every Vehicle
          </h1>
          <p className="text-lg text-charcoal-600 mb-6">
            Find the right parts for your car, truck, or motorcycle with our
            vehicle compatibility finder.
          </p>
          <Link
            to="/products"
            className="inline-flex items-center px-6 py-3 btn-primary text-sm font-medium"
          >
            Shop All Parts
          </Link>
        </div>
      </div>
    </section>
  );
};

const FeaturedProductsSection: React.FC<{ products: Product[] }> = ({ products }) => {
  return (
    <section className="py-12 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-charcoal-900">Featured Products</h2>
          <Link to="/products?featured=true" className="text-sm text-automotive-red hover:text-automotive-red-dark">
            View All
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} className="card" />
          ))}
        </div>
      </div>
    </section>
  );
};

const CategoriesSection: React.FC<{ categories: Category[] }> = ({ categories }) => {
  return (
    <section className="py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-charcoal-900 mb-8">Shop by Category</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {categories.map((category) => (
            <Link
              key={category.id}
              to={`/products?category=${category.slug}`}
              className="block bg-white rounded-xl shadow-sm border border-neutral-border hover:shadow-md transition-shadow duration-200 p-6"
            >
              <div className="flex items-center justify-center h-24 mb-4">
                {category.image_url ? (
                  <img src={category.image_url} alt={category.name} className="max-w-full max-h-full object-contain" />
                ) : (
                  <div className="flex items-center justify-center w-16 h-16 bg-charcoal-100 rounded-full text-charcoal-300">
                    {category.name[0]}
                  </div>
                )}
              </div>
              <h3 className="text-lg font-medium text-charcoal-900 text-center">
                {category.name}
              </h3>
              <p className="text-sm text-charcoal-500 text-center mt-2">
                {category.product_count} products
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

const BrandsSection: React.FC<{ brands: Brand[] }> = ({ brands }) => {
  return (
    <section className="py-12 bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-charcoal-900 mb-8">Trusted Brands</h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {brands.map((brand) => (
            <Link
              key={brand.id}
              to={`/products?brand=${brand.slug}`}
              className="block bg-white rounded-xl shadow-sm border border-neutral-border hover:shadow-md transition-shadow duration-200 p-4 flex flex-col items-center justify-center"
            >
              {brand.logo_url ? (
                <img
                  src={brand.logo_url}
                  alt={brand.name}
                  className="max-w-full max-h-16 object-contain mb-2"
                />
              ) : (
                <div className="flex items-center justify-center w-16 h-16 bg-charcoal-100 rounded-full text-charcoal-300 mb-2">
                  {brand.name[0]}
                </div>
              )}
              <h3 className="text-lg font-medium text-charcoal-900 text-center">
                {brand.name}
              </h3>
              <p className="text-sm text-charcoal-500 text-center">
                {brand.product_count} products
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};