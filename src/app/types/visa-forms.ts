// Common fields for all visa applications
export interface CommonApplicationData {
  // Contact Information
  email: string;
  phone: string;
  telegramLogin: string;
  
  // How did you hear about us
  hearAbout: {
    telegram: boolean;
    youtube: boolean;
    instagram: boolean;
    vk: boolean;
    rutube: boolean;
    friends: boolean;
    previousVisa: boolean;
  };
  
  // Photos
  photoFace: File | null;
  photoPassport: File | null;
  photoPreviousVisa: File | null;
  
  // Optional services
  hotelBooking: boolean;
  returnTicket: boolean;
  
  // Payment
  paymentScreenshot: File | null;
}

// India specific fields
export interface IndiaVisaData extends CommonApplicationData {
  // Basic Data
  citizenship: string;
  arrivalAirport: string;
  arrivalDate: string;
  previousSurname: string;
  previousName: string;
  cityOfBirth: string;
  previousCitizenship: string;
  internalPassportSeries: string;
  internalPassportNumber: string;
  lived2YearsInCountry: boolean;
  registrationAddress: {
    zip: string;
    region: string;
    city: string;
    street: string;
    building: string;
  };
  residenceAddress: string;
  fatherInfo: {
    name: string;
    citizenship: string;
    cityOfBirth: string;
  };
  motherInfo: {
    name: string;
    citizenship: string;
    cityOfBirth: string;
  };
  maritalStatus: string;
  spouseInfo?: {
    name: string;
    nationality: string;
    placeOfBirth: string;
    country: string;
  };
  workplace: {
    company: string;
    address: string;
    position: string;
    phone: string;
    email: string;
  };
  militaryService?: {
    organization: string;
    unitNumber: string;
    position: string;
    rank: string;
    location: string;
  };
  indiaVisaRejections?: string;
  plannedCities: string;
  visitedCountries10Years: string;
  visitedIndiaBefore: string;
  visitedSouthAsia?: string;
  hotelInfo: {
    name: string;
    address: string;
    phone: string;
  };
  contactInIndia: {
    name: string;
    address: string;
    phone: string;
  };
  emergencyContact: {
    name: string;
    address: string;
    phone: string;
  };
}

// Vietnam specific fields
export interface VietnamVisaData extends CommonApplicationData {
  citizenship: string;
  countryOfBirth: string;
  secondCitizenship?: string;
  lawViolations?: {
    violation: string;
    date: string;
    sanction: string;
    person: string;
  };
  usedOtherPassports?: string;
  stayDates: {
    from: string;
    to: string;
  };
  registrationAddress: string;
  residenceAddress?: string;
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
  workStudy: string;
  purposeOfVisit: string;
  agreeNotWorkOrBusiness: boolean;
  contactsInVietnam?: string;
  arrivalAirport: string;
  departureAirport: string;
  addressInVietnam: string;
  previousVisitVietnam?: {
    dates: string;
    purpose: string;
  };
  childInPassport?: File;
}

// Sri Lanka specific fields
export interface SriLankaVisaData extends CommonApplicationData {
  citizenship: string;
  countryOfBirth: string;
  last14DaysCountry: string;
  expectedArrivalDate: string;
  departureAirport?: string;
  airlineOrShip?: string;
  residenceAddress: string;
  addressInSriLanka?: string;
  hasResidentVisa: boolean;
  alreadyInSriLanka: boolean;
  multipleEntryVisa: boolean;
  // Extension fields
  homeAddress?: string;
  arrivalDateSriLanka?: string;
  mobilePhoneRF?: string;
  mobilePhoneSL?: string;
}

// South Korea specific fields
export interface KoreaVisaData extends CommonApplicationData {
  purposeOfTrip: string;
  previouslyInKorea: boolean;
  dualCitizenship: boolean;
  secondPassportPhoto?: File;
  criminalRecord: boolean;
  dangerousDiseases: boolean;
  contactsInKorea?: {
    name: string;
    phone: string;
  };
  companions?: Array<{
    name: string;
    birthDate: string;
    relationship: string;
  }>;
  work?: {
    companyName: string;
    position: string;
    phone: string;
    salary: string;
  };
  countriesVisitedCount: number;
  tripDates: {
    from: string;
    to: string;
  };
  addressInKorea: {
    zip: string;
    phone: string;
    hotelName: string;
  };
}

// Israel specific fields
export interface IsraelVisaData extends CommonApplicationData {
  citizenship: string;
  arrivalDate: string;
  arrivalAirport: string;
  biometricPassport: boolean;
  secondCitizenship: boolean;
  maritalStatus: string;
  fatherInfo: {
    name: string;
    citizenship: string;
  };
  motherInfo: {
    name: string;
    citizenship: string;
  };
  homeAddress: string;
}

// Pakistan specific fields
export interface PakistanVisaData extends CommonApplicationData {
  stayDuration: number;
  entryPort: string;
  exitPort: string;
  stayDate: string;
  maritalStatus: string;
  fatherInfo: {
    name: string;
    nationality: string;
  };
  motherInfo: {
    name: string;
    nationality: string;
  };
  workplace: {
    company: string;
    position: string;
    address: string;
  };
  addressInPakistan: string;
}

// Cambodia specific fields
export interface CambodiaVisaData extends CommonApplicationData {
  expectedEntryDate: string;
  residenceAddress: string;
  addressInCambodia: string;
  entryPort: string;
}

// Kenya specific fields
export interface KenyaVisaData extends CommonApplicationData {
  profession: string;
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
  arrivalDate: string;
  departureDate: string;
  entryPort: string;
  arrivalAirline: string;
  arrivalFlightNumber: string;
  arrivalCountry: string;
  exitPort: string;
  departureAirline: string;
  departureFlightNumber: string;
  departureCountry: string;
  addressInKenya: string;
  countryOfBirth: string;
  criminalRecord5Years: boolean;
  entryRefusals: boolean;
  previouslyInKenya: boolean;
  currencyOver5000: boolean;
  currencyAmount?: number;
}
