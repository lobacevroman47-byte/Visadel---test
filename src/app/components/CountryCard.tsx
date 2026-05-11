import { useState } from 'react';
import { ChevronDown, AlertCircle } from 'lucide-react';
import type { Country, VisaOption } from '../App';

interface CountryCardProps {
  country: {
    id: Country;
    name: string;
    flag: string;
    visas: VisaOption[];
    hasUrgent: boolean;
    urgentSeparate?: boolean;
  };
  onSelect: (country: Country, visa: VisaOption, urgent?: boolean) => void;
}

export default function CountryCard({ country, onSelect }: CountryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-4xl">{country.flag}</span>
          <div className="text-left">
            <h3>{country.name}</h3>
            <p className="text-gray-600 text-sm">
              от {Math.min(...country.visas.map(v => v.price))}₽
            </p>
          </div>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isExpanded && (
        <div className="border-t border-gray-200 p-4 space-y-3">
          {country.visas.map((visa) => (
            <div key={visa.id} className="space-y-2">
              <button
                onClick={() => onSelect(country.id, visa, false)}
                className="w-full p-3 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors text-left"
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-blue-900">{visa.name}</span>
                  <span className="text-blue-600">{visa.price}₽</span>
                </div>
                <p className="text-blue-600 text-sm">{visa.duration}</p>
              </button>

              {country.hasUrgent && !country.urgentSeparate && (
                <button
                  onClick={() => onSelect(country.id, visa, true)}
                  className="w-full p-3 rounded-lg bg-red-50 hover:bg-red-100 transition-colors text-left flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-red-900">🚨 Срочное оформление</span>
                      <span className="text-red-600">+1000₽</span>
                    </div>
                    <p className="text-red-600 text-sm">Приоритетная обработка вашей заявки</p>
                  </div>
                </button>
              )}
            </div>
          ))}

          {country.urgentSeparate && (
            <button
              onClick={() => onSelect(country.id, country.visas[0], true)}
              className="w-full p-3 rounded-lg bg-red-50 hover:bg-red-100 transition-colors text-left"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <span className="text-red-900">🚨 Срочные визы</span>
                  <p className="text-red-600 text-sm mt-1">Специальное предложение для Вьетнама</p>
                </div>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
