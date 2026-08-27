import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backTo?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, backTo = '/', backLabel = 'Volver', actions }) => (
  <div className="mb-8">
    <Link to={backTo} className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-800">
      <ChevronLeft className="h-4 w-4 mr-1" />
      {backLabel}
    </Link>
    <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  </div>
);

export default PageHeader;
