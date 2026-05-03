import { Info } from 'lucide-react';

interface FormFieldProps {
  label: string;
  required?: boolean;
  helper?: string;
  error?: string;
  children: React.ReactNode;
}

export default function FormField({ label, required, helper, error, children }: FormFieldProps) {
  return (
    <div className="space-y-2">
      <label className="block">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {helper && (
        <div className="flex items-start gap-2 text-sm text-gray-600">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{helper}</span>
        </div>
      )}
      {error && (
        <p className="text-red-600 text-sm">{error}</p>
      )}
    </div>
  );
}
