export const DEFAULT_VAULT_DOCUMENTS = [
  {
    id: 'doc-1',
    name: 'College ID',
    status: 'Available',
    category: 'Identification',
    fileType: 'PDF',
    size: '1.2 MB',
    lastVerified: '12 Aug 2026',
    icon: 'id-card'
  },
  {
    id: 'doc-2',
    name: 'Fee Receipt',
    status: 'Available',
    category: 'Finance',
    fileType: 'PDF',
    size: '840 KB',
    lastVerified: '18 Aug 2026',
    icon: 'receipt'
  },
  {
    id: 'doc-3',
    name: 'Internship Certificate',
    status: 'Missing',
    category: 'Academic & Career',
    fileType: null,
    size: null,
    lastVerified: null,
    icon: 'award'
  },
  {
    id: 'doc-4',
    name: 'Admission Letter',
    status: 'Available',
    category: 'Enrollment',
    fileType: 'PDF',
    size: '2.4 MB',
    lastVerified: '01 Jul 2026',
    icon: 'file-text'
  }
];

/**
 * Checks how many required documents from a list or list of tasks are available in the vault.
 * Returns { readyCount, totalRequired, missingDocs, availableDocs }
 */
export function checkDocumentReadiness(requiredDocs = [], vaultDocs = DEFAULT_VAULT_DOCUMENTS) {
  if (!requiredDocs || requiredDocs.length === 0) {
    return { readyCount: 0, totalRequired: 0, missingDocs: [], availableDocs: [], ratio: 1 };
  }

  // Normalize document names for fuzzy matching
  const normalize = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const availableVaultNames = vaultDocs
    .filter((doc) => doc.status === 'Available')
    .map((doc) => normalize(doc.name));

  const missingDocs = [];
  const availableDocs = [];

  requiredDocs.forEach((docName) => {
    const norm = normalize(docName);
    const isAvailable = availableVaultNames.some(
      (vName) => vName.includes(norm) || norm.includes(vName)
    );

    if (isAvailable) {
      availableDocs.push(docName);
    } else {
      missingDocs.push(docName);
    }
  });

  return {
    readyCount: availableDocs.length,
    totalRequired: requiredDocs.length,
    missingDocs,
    availableDocs,
    isAllReady: missingDocs.length === 0,
    ratio: requiredDocs.length > 0 ? availableDocs.length / requiredDocs.length : 1
  };
}
