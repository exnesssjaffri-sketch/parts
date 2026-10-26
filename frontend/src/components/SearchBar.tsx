import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

export const SearchBar: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/products?search=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex h-10 w-64 rounded-md border border-neutral-border"
    >
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search products..."
        className="flex-1 px-3 py-0 text-sm focus:outline-none focus:ring-2 focus:ring-automotive-red"
      />
      <button type="submit" className="px-4 bg-automotive-red text-white hover:bg-automotive-red-dark">
        Search
      </button>
    </form>
  );
};