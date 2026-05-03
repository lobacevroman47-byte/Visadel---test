import { useState } from 'react';
import type { Country } from '../../App';
import type { FormData } from '../ApplicationForm';
import IndiaForm from './countries/IndiaForm';
import VietnamForm from './countries/VietnamForm';
import SouthKoreaForm from './countries/SouthKoreaForm';
import IsraelForm from './countries/IsraelForm';
import CambodiaForm from './countries/CambodiaForm';
import KenyaForm from './countries/KenyaForm';
import PakistanForm from './countries/PakistanForm';
import SriLankaForm from './countries/SriLankaForm';

interface Step1Props {
  country: Country;
  formData: FormData;
  updateFormData: (data: Partial<FormData>) => void;
  onNext: () => void;
}

export default function Step1BasicData({ country, formData, updateFormData, onNext }: Step1Props) {
  const renderCountryForm = () => {
    const props = { formData, updateFormData, onNext };

    switch (country) {
      case 'india':
        return <IndiaForm {...props} />;
      case 'vietnam':
        return <VietnamForm {...props} />;
      case 'south-korea':
        return <SouthKoreaForm {...props} />;
      case 'israel':
        return <IsraelForm {...props} />;
      case 'cambodia':
        return <CambodiaForm {...props} />;
      case 'kenya':
        return <KenyaForm {...props} />;
      case 'pakistan':
        return <PakistanForm {...props} />;
      case 'sri-lanka':
        return <SriLankaForm {...props} />;
      default:
        return <div>Форма для этой страны в разработке</div>;
    }
  };

  return (
    <div>
      <h2 className="mb-6">Основные данные</h2>
      {renderCountryForm()}
    </div>
  );
}
