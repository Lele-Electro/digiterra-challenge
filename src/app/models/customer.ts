export interface customer {
  id: id;
  customerDetails: details;
  customerAddress:address
  customerComment:comment;
}


export enum customerPaths {
  allCustomers = '/',
  details = '/customers/new/details',
  address = '/customers/new/address',
  comments = '/customers/new/comment',
  submit = '/customers/new/submit',
  moredetails = '/customers',
}


export interface details {
  firstName: string | null;
  lastName: string | null;
  cellNumber: string | null;
}
export interface id
 {
  id: string | null;
}

export interface address{

    physicalAddress: physicalAddress
    postalAddress: postalAddress

}
export interface physicalAddress {
  lineOne: string | null;
  city: string | null;
  country: string | null;
  code: string | null;
}

export interface postalAddress {
  lineOne: string | null;
  city: string | null;
  country: string | null;
  code: string | null;
}

export interface comment {
  comment: string | null;
}

export enum customerSections {
  details,
  addresses,
  comment
}

export interface backendCustomer {

}

export interface customerProgressTracker {
  sections : customerSections
  customer: customer
}

export interface storedCustomer{
  _id: string
  firstName: string
  lastName: string
  cellNumber: string
  lineOne: string
  city: string
  country: string
  code: string
  postalLineOne: string
  postalCity: string
  postalCountry: string
  postalCode: string
  customerComment: string
  __v: number
}
