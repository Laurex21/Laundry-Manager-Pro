export class ApiResponseError extends Error {
  constructor(public status: number, public code?: string, message?: string, public feature?: string) {
    super(message || `HTTP ${status}`); this.name = 'ApiResponseError';
  }
}
export async function requireOk(response: Response): Promise<void> {
  if (response.ok) return;
  const text = await response.text();
  let body: any = null;
  try { body = JSON.parse(text); } catch {}
  // Keep the existing queryClient message envelope for consumers parsing validation bodies.
  throw new ApiResponseError(response.status, body?.code, `${response.status}: ${body ? JSON.stringify(body) : response.statusText}`, body?.feature);
}
export function historicalSite(user: any, siteId = user?.currentSite?.id): boolean {
  return !!user?.saas && siteId != null && !user.saas.activeSiteIds.includes(siteId);
}
export function accessCopy(language: string) {
  return language.startsWith('fr') ? {
    historical: 'Cette boutique est en consultation historique. Ses données restent accessibles, mais les modifications sont désactivées. Business permet d’exploiter plusieurs boutiques.',
    active: 'Revenir à une boutique active', business: 'Découvrir Business', plans: 'Voir Pro et Business',
    premium: 'Ces analyses sont disponibles avec Pro et Business. Passez à une formule supérieure pour suivre vos clients à risque et vos délais de retrait.',
    owner: 'Contactez le propriétaire pour changer de formule ou de boutique.',
    forbidden: 'Votre rôle ne permet pas cette action. Contactez le propriétaire de la boutique.',
    suspended: 'Votre accès est suspendu par l’abonnement de l’entreprise. Contactez le propriétaire.',
    login: 'Votre session a expiré. Reconnectez-vous avant de réessayer.',
    invalid: 'Le changement demandé n’est pas valide. Vérifiez le statut et les informations de la commande.',
    missing: 'Cette commande est introuvable ou n’est plus accessible.',
    conflict: 'La commande a changé. Actualisez la page avant de réessayer.',
    failure: 'Le changement de statut n’a pas pu être confirmé. Actualisez la commande pour vérifier son état avant de réessayer.',
    load: 'Ces analyses sont momentanément indisponibles. Réessayez plus tard.',
    updated: 'Statut mis à jour', error: 'Action indisponible', number: 'N° de commande',
  } : language.startsWith('pt') ? {
    historical: 'Esta loja está em consulta histórica. Os dados continuam acessíveis, mas as alterações estão desativadas. O Business permite operar várias lojas.',
    active: 'Voltar a uma loja ativa', business: 'Conhecer o Business', plans: 'Ver Pro e Business',
    premium: 'Estas análises estão disponíveis com Pro e Business. Mude de plano para acompanhar clientes em risco e atrasos nas retiradas.',
    owner: 'Contacte o proprietário para mudar de plano ou de loja.', forbidden: 'O seu perfil não permite esta ação. Contacte o proprietário.',
    suspended: 'O seu acesso foi suspenso pela assinatura da empresa. Contacte o proprietário.',
    login: 'A sua sessão expirou. Inicie sessão novamente.', invalid: 'A alteração não é válida. Verifique o estado e os dados do pedido.',
    missing: 'Este pedido não foi encontrado ou já não está acessível.', conflict: 'O pedido mudou. Atualize a página antes de tentar novamente.',
    failure: 'Não foi possível confirmar a alteração. Atualize o pedido para verificar o estado antes de tentar novamente.',
    load: 'Estas análises estão temporariamente indisponíveis. Tente novamente mais tarde.', updated: 'Estado atualizado', error: 'Ação indisponível', number: 'N.º do pedido',
  } : {
    historical: 'This site is available for historical consultation. Its data remains accessible, but changes are disabled. Business lets you operate multiple sites.',
    active: 'Return to an active site', business: 'Discover Business', plans: 'View Pro and Business',
    premium: 'These analyses are available with Pro and Business. Upgrade to track at-risk customers and overdue pickups.',
    owner: 'Contact the owner to change plans or sites.', forbidden: 'Your role does not allow this action. Contact the site owner.',
    suspended: 'Your access is suspended by the business subscription. Contact the owner.',
    login: 'Your session has expired. Sign in again before retrying.', invalid: 'This change is invalid. Check the order status and details.',
    missing: 'This order was not found or is no longer accessible.', conflict: 'The order has changed. Refresh the page before retrying.',
    failure: 'The status change could not be confirmed. Refresh the order to check its state before retrying.',
    load: 'These analyses are temporarily unavailable. Please try again later.', updated: 'Status updated', error: 'Action unavailable', number: 'Order number',
  };
}
export function failureKind(error: unknown): 'historical' | 'premium' | 'suspended' | 'login' | 'forbidden' | 'invalid' | 'missing' | 'conflict' | 'failure' {
  if (!(error instanceof ApiResponseError)) return 'failure';
  if (error.status === 403 && error.code === 'SAAS_SITE_READ_ONLY') return 'historical';
  if (error.status === 403 && error.code === 'SAAS_FEATURE_REQUIRED') return 'premium';
  if (error.status === 403 && error.code === 'SAAS_STAFF_SUSPENDED') return 'suspended';
  return error.status === 401 ? 'login' : error.status === 403 ? 'forbidden' : error.status === 404 ? 'missing' : error.status === 409 ? 'conflict' : [400,422].includes(error.status) ? 'invalid' : 'failure';
}
