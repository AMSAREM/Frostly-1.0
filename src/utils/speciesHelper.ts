import { SpeciesCategory, StorageZone } from '../types';

export const VALID_SPECIES_IDS = [
  'spec-bluefin',
  'spec-yellowfin',
  'spec-salmon',
  'spec-kingcrab',
  'spec-lobster',
  'spec-blacktiger',
  'spec-oyster',
  'spec-blackcod',
  'spec-landed',
] as const;

/**
 * Resolves a valid speciesId that exists in the master species database table
 * to ensure foreign key constraint integrity (`fk_inventory_batches_species`).
 */
export function getSpeciesIdFromName(name?: string, currentId?: string): string {
  if (currentId && (VALID_SPECIES_IDS as readonly string[]).includes(currentId)) {
    return currentId;
  }

  const s = (name || '').toLowerCase();
  if (s.includes('bluefin')) return 'spec-bluefin';
  if (s.includes('yellowfin') || s.includes('ahi') || s.includes('tuna')) return 'spec-yellowfin';
  if (s.includes('salmon') || s.includes('trout')) return 'spec-salmon';
  if (s.includes('crab')) return 'spec-kingcrab';
  if (s.includes('lobster')) return 'spec-lobster';
  if (s.includes('prawn') || s.includes('shrimp') || s.includes('tiger')) return 'spec-blacktiger';
  if (s.includes('oyster') || s.includes('scallop') || s.includes('clam') || s.includes('mollusk')) return 'spec-oyster';
  if (s.includes('cod') || s.includes('sablefish') || s.includes('groundfish')) return 'spec-blackcod';

  return 'spec-landed';
}

export function getSpeciesTaxonomy(speciesId: string): {
  scientificName: string;
  category: SpeciesCategory;
  defaultZone: StorageZone;
} {
  switch (speciesId) {
    case 'spec-bluefin':
      return {
        scientificName: 'Thunnus orientalis',
        category: 'Pelagic',
        defaultZone: 'Super-Cryo Deep Freeze (-60°C)',
      };
    case 'spec-yellowfin':
      return {
        scientificName: 'Thunnus albacares',
        category: 'Pelagic',
        defaultZone: 'Super-Cryo Deep Freeze (-60°C)',
      };
    case 'spec-salmon':
      return {
        scientificName: 'Salmo salar / Oncorhynchus tshawytscha',
        category: 'Salmonid',
        defaultZone: 'Fresh Slush Ice (0°C to +2°C)',
      };
    case 'spec-kingcrab':
      return {
        scientificName: 'Paralithodes camtschaticus',
        category: 'Crustacean',
        defaultZone: 'Commercial Cold Storage (-22°C)',
      };
    case 'spec-lobster':
      return {
        scientificName: 'Homarus americanus',
        category: 'Crustacean',
        defaultZone: 'Live Seawater Tank (+8°C)',
      };
    case 'spec-blacktiger':
      return {
        scientificName: 'Penaeus monodon',
        category: 'Crustacean',
        defaultZone: 'Commercial Cold Storage (-22°C)',
      };
    case 'spec-oyster':
      return {
        scientificName: 'Crassostrea sikamea / Ostrea edulis',
        category: 'Mollusk',
        defaultZone: 'Fresh Slush Ice (0°C to +2°C)',
      };
    case 'spec-blackcod':
      return {
        scientificName: 'Anoplopoma fimbria',
        category: 'Groundfish',
        defaultZone: 'Commercial Cold Storage (-22°C)',
      };
    case 'spec-landed':
    default:
      return {
        scientificName: 'Harvest Catch Provenance',
        category: 'Pelagic',
        defaultZone: 'Commercial Cold Storage (-22°C)',
      };
  }
}
