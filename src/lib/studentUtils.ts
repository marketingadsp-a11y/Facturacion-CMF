
/**
 * Utility to calculate the first 16 characters of the CURP (Clave Única de Registro de Población)
 * Note: The last 2 digits (homoclave) are assigned by RENAPO and cannot be calculated with 100% certainty.
 */

const STATES = [
  { code: 'AS', name: 'Aguascalientes' },
  { code: 'BC', name: 'Baja California' },
  { code: 'BS', name: 'Baja California Sur' },
  { code: 'CC', name: 'Campeche' },
  { code: 'CL', name: 'Coahuila' },
  { code: 'CM', name: 'Colima' },
  { code: 'CS', name: 'Chiapas' },
  { code: 'CH', name: 'Chihuahua' },
  { code: 'DF', name: 'Ciudad de México' },
  { code: 'DG', name: 'Durango' },
  { code: 'GT', name: 'Guanajuato' },
  { code: 'GR', name: 'Guerrero' },
  { code: 'HG', name: 'Hidalgo' },
  { code: 'JC', name: 'Jalisco' },
  { code: 'MC', name: 'México' },
  { code: 'MN', name: 'Michoacán' },
  { code: 'MS', name: 'Morelos' },
  { code: 'NT', name: 'Nayarit' },
  { code: 'NL', name: 'Nuevo León' },
  { code: 'OC', name: 'Oaxaca' },
  { code: 'PL', name: 'Puebla' },
  { code: 'QT', name: 'Querétaro' },
  { code: 'QR', name: 'Quintana Roo' },
  { code: 'SP', name: 'San Luis Potosí' },
  { code: 'SL', name: 'Sinaloa' },
  { code: 'SR', name: 'Sonora' },
  { code: 'TC', name: 'Tabasco' },
  { code: 'TS', name: 'Tamaulipas' },
  { code: 'TL', name: 'Tlaxcala' },
  { code: 'VZ', name: 'Veracruz' },
  { code: 'YN', name: 'Yucatán' },
  { code: 'ZS', name: 'Zacatecas' },
  { code: 'NE', name: 'Nacido en el Extranjero' }
];

export { STATES };

export function calculateCURP(data: {
  firstName: string;
  lastName: string;
  motherLastName?: string;
  birthDate: string; // YYYY-MM-DD
  gender: 'H' | 'M';
  birthState: string;
}): string {
  const { firstName, lastName, motherLastName = '', birthDate, gender, birthState } = data;

  const cleanString = (str: string) => {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
  };

  const name = cleanString(firstName);
  const paternal = cleanString(lastName);
  const maternal = cleanString(motherLastName) || 'X';

  const isVowel = (c: string) => 'AEIOU'.includes(c);
  const isConsonant = (c: string) => /^[B-DF-HJ-NP-TV-Z]$/.test(c);

  const getFirstInternalVowel = (str: string) => {
    for (let i = 1; i < str.length; i++) {
        if (isVowel(str[i])) return str[i];
    }
    return 'X';
  };

  const getFirstInternalConsonant = (str: string) => {
    for (let i = 1; i < str.length; i++) {
        if (isConsonant(str[i])) return str[i];
    }
    return 'X';
  };

  const firstLetter = paternal[0] || 'X';
  const firstVowel = getFirstInternalVowel(paternal);
  const maternalLetter = maternal[0] || 'X';

  // For names, if it starts with MARIA or JOSE and has a second name, use the second name
  const nameParts = name.split(/\s+/);
  let nameToUse = nameParts[0];
  if ((nameParts[0] === 'MARIA' || nameParts[0] === 'JOSE') && nameParts.length > 1) {
    nameToUse = nameParts[1];
  }
  const nameLetter = nameToUse[0] || 'X';

  const [year, month, day] = birthDate.split('-');
  const dateStr = `${year.slice(-2)}${month}${day}`;

  const internalPaternal = getFirstInternalConsonant(paternal);
  const internalMaternal = getFirstInternalConsonant(maternal);
  const internalName = getFirstInternalConsonant(nameToUse);

  let curpPrefix = `${firstLetter}${firstVowel}${maternalLetter}${nameLetter}${dateStr}${gender}${birthState}${internalPaternal}${internalMaternal}${internalName}`;

  // Simple profanity filter base (common ones in CURP algorithm)
  const forbidden = ["BACA", "BAKA", "BUEI", "BUEY", "CACA", "CACO", "CAGA", "CAGO", "CAKA", "CAKO", "COGE", "COGI", "COJA", "COJE", "COJI", "COJO", "COLA", "CULO", "FALO", "FETO", "GETA", "GUEI", "GUEY", "JETA", "JOTO", "KACA", "KACO", "KAGA", "KAGO", "KAKA", "KAKO", "KOGE", "KOGI", "KOJA", "KOJE", "KOJI", "KOJO", "KOLA", "KULO", "LILO", "LOCA", "LOCO", "LOKA", "LOKO", "MAME", "MAMO", "MEAR", "MEAS", "MEON", "MIAR", "MION", "MOCO", "MOKO", "MULA", "PEDA", "PEDO", "PENE", "PUTA", "PUTO", "QULO", "RATA", "ROBA", "ROBE", "ROBO", "RUIN", "SENO", "TETA", "VACA", "VAGA", "VAGO", "VAKA", "VUEI", "VUEY", "WUEI", "WUEY"];
  
  const prefix = curpPrefix.slice(0, 4);
  if (forbidden.includes(prefix)) {
    curpPrefix = prefix[0] + 'X' + prefix.slice(2) + curpPrefix.slice(4);
  }

  return curpPrefix.toUpperCase();
}
