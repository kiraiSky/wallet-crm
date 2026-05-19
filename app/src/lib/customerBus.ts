export const OPEN_CUSTOMER_EVENT = 'carteira:open-customer'

export type OpenCustomerDetail = { id: string }

export function openCustomerQuickView(id: string) {
  window.dispatchEvent(new CustomEvent<OpenCustomerDetail>(OPEN_CUSTOMER_EVENT, { detail: { id } }))
}
