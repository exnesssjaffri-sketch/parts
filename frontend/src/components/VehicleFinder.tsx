import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { VehicleMake, VehicleModel, VehicleVariant } from '../types';

export const VehicleFinder: React.FC = () => {
  const { user } = useAuth();
  const [makes, setMakes] = useState<VehicleMake[]>([]);
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [variants, setVariants] = useState<VehicleVariant[]>([]);
  const [selectedMake, setSelectedMake] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    api.getVehicleMakes().then((res) => setMakes(res.makes));
  }, []);

  useEffect(() => {
    if (selectedMake) {
      setLoading(true);
      api.getVehicleModels(selectedMake).then((res) => {
        setModels(res.models);
        setSelectedModel('');
        setVariants([]);
        setLoading(false);
      });
    } else {
      setModels([]);
      setVariants([]);
      setSelectedModel('');
    }
  }, [selectedMake]);

  useEffect(() => {
    if (selectedModel) {
      setLoading(true);
      api.getVehicleVariants(selectedModel).then((res) => {
        setVariants(res.variants);
        setLoading(false);
      });
    } else {
      setVariants([]);
      setLoading(false);
    }
  }, [selectedModel]);

  const handleSelectVariant = (variantId: number) => {
    if (user) {
      // Redirect to compatible products for this variant
      // In a real app, we might have a dedicated page for this
      console.log('View compatible products for variant:', variantId);
    }
  };

  if (loading) {
    return (
      <div className="relative inline-block">
        <button className="flex items-center space-x-2 text-sm text-charcoal-600 hover:text-automotive-red transition-colors">
          <span className="animate-spin h-4 w-4"></span>
          Finding parts...
        </button>
      </div>
    );
  }

  return (
    <div className="relative inline-block">
      <div className="flex space-x-2">
        <select
          value={selectedMake}
          onChange={(e) => setSelectedMake(e.target.value)}
          className="min-w-[80px] px-2 py-1 border border-neutral-border rounded-l-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
        >
          <option value="">All Makes</option>
          {makes.map((make) => (
            <option key={make.id} value={make.slug}>
              {make.name}
            </option>
          ))}
        </select>

        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          disabled={!selectedMake}
          className="min-w-[80px] px-2 py-1 border border-neutral-border focus:outline-none focus:ring-2 focus:ring-automotive-red"
        >
          <option value="">All Models</option>
          {models.map((model) => (
            <option key={model.id} value={model.slug}>
              {model.name}
            </option>
          ))}
        </select>

        <select
          onChange={(e) => {
            const variant = variants.find((v) => v.slug === e.target.value);
            if (variant) handleSelectVariant(variant.id);
          }}
          disabled={!selectedModel || variants.length === 0}
          className="min-w-[80px] px-2 py-1 border border-neutral-border rounded-r-lg focus:outline-none focus:ring-2 focus:ring-automotive-red"
        >
          <option value="">All Variants</option>
          {variants.map((variant) => (
            <option key={variant.id} value={variant.slug}>
              {variant.year} {variant.model_name} {variant.engine || ''}
            </option>
          ))}
        </select>
      </div>
      <div className="absolute right-0 mt-1">
        <button className="px-2 py-1 text-sm text-charcoal-600 hover:text-automotive-red transition-colors">
          Find Parts
        </button>
      </div>
    </div>
  );
};