// Catalog — единый раздел админки, объединяющий бывшие «Каталог продуктов»
// и «Конструктор анкет». Раньше эти разделы пересекались (один объект
// редактировался из двух мест: цена в Каталоге, поля анкеты в Конструкторе).
// Теперь один источник истины:
//
//   * Визы       → подвкладки «Каталог виз» (карточки) + «Поля анкеты» + «Фото»
//   * Доп. услуги → AdditionalServices addons (visa-аддоны)
//   * Брони       → AdditionalServices bookings (standalone)
//
// При клике на entity открывается единый редактор. Никаких изменений в
// бизнес-логике — все данные в тех же таблицах (visa_products,
// visa_form_fields, additional_services, app_settings). Изменения сразу
// видны в Mini App, как и раньше.

import React, { useState } from 'react';
import { FileText, Package, Hotel, FileEdit } from 'lucide-react';
import { Countries } from './Countries';
import { AdditionalServices } from './AdditionalServices';
import { VisaFormSection } from './FormBuilder';

type TopTab = 'visas' | 'addons' | 'bookings';
// «Фото-требования» доступны внутри «Поля анкеты» (внутренний таб
// VisaFormSection), поэтому отдельный sub-tab не нужен — убрали дубль.
type VisasSubTab = 'catalog' | 'form';

const TOP_TABS: { id: TopTab; label: string; Icon: typeof FileText }[] = [
  { id: 'visas',    label: 'Визы',        Icon: FileText },
  { id: 'addons',   label: 'Доп. услуги', Icon: Package  },
  { id: 'bookings', label: 'Брони',       Icon: Hotel    },
];

const VISAS_SUB_TABS: { id: VisasSubTab; label: string; Icon: typeof FileText }[] = [
  { id: 'catalog', label: 'Каталог виз', Icon: FileText },
  { id: 'form',    label: 'Поля анкеты', Icon: FileEdit },
];

export const Catalog: React.FC = () => {
  const [topTab, setTopTab] = useState<TopTab>('visas');
  const [visasSubTab, setVisasSubTab] = useState<VisasSubTab>('catalog');

  return (
    <div>
      {/* Top nav — Визы / Доп. услуги / Брони */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 pt-4">
        <div className="flex gap-1.5 flex-wrap">
          {TOP_TABS.map(({ id, label, Icon }) => {
            const active = topTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTopTab(id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-lg text-sm font-semibold transition ${
                  active
                    ? 'vd-grad text-white shadow-md'
                    : 'bg-gray-50 text-[#0F2A36]/65 hover:bg-gray-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'stroke-[2.5]' : 'stroke-2'}`} />
                {label}
              </button>
            );
          })}
        </div>

        {/* Sub-nav для Виз (Каталог / Поля / Фото). Доп. услуги и Брони
            один раздел — sub-nav не нужен. */}
        {topTab === 'visas' && (
          <div className="flex gap-1.5 flex-wrap pt-2 pb-1">
            {VISAS_SUB_TABS.map(({ id, label, Icon }) => {
              const active = visasSubTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setVisasSubTab(id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    active
                      ? 'bg-[#EAF1FF] text-[#3B5BFF]'
                      : 'text-[#0F2A36]/60 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {topTab === 'visas' && visasSubTab === 'catalog' && <Countries renderTopNav={false} />}
      {topTab === 'visas' && visasSubTab === 'form' && <VisaFormSection initialTab="fields" />}
      {topTab === 'addons'   && <AdditionalServices mode="addons" />}
      {topTab === 'bookings' && <AdditionalServices mode="bookings" />}
    </div>
  );
};
