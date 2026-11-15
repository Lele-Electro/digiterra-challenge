import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { customer, storedCustomer } from '../models/customer';
import { BehaviorSubject } from 'rxjs';

declare global {
  interface Window {
    APP_CONFIG?: {
      apiBaseUrl?: string;
    };
  }
}

@Injectable({
  providedIn: 'root'
})
export class NewCustomerService {
  readonly baseUrl = window.APP_CONFIG?.apiBaseUrl;
  private customers: customer[] = [];
  private persistedCustomerCount = new BehaviorSubject<number>(0);
  currentCount = this.persistedCustomerCount.asObservable()

  constructor(
    private http: HttpClient
  ) {
    if (!this.baseUrl) {
      throw new Error('The API base URL is missing from assets/app-config.js.');
    }
  }

  updateCustomerCount(number: number){
    this.persistedCustomerCount.next(number)
  }

  getCustomers(){
    return this.http.get<{message: string, customers: storedCustomer[]}>(`${this.baseUrl}/api/customers`)
    .subscribe( (customerData) => {
      this.storeCustomersInLocalStorage(customerData.customers);
      this.persistedCustomerCount.next(customerData.customers.length);

    })



  }

addcustomer(customer: customer){
 return this.http
.post<{message:string}>(`${this.baseUrl}/api/customers`, customer);

}

storeCustomersInLocalStorage(storedcustomers: any[]){
  let serializedCustomerObjects = JSON.stringify(storedcustomers)
  localStorage.setItem('storedCustomers', serializedCustomerObjects)

}

retrieveCustomersInLocalStorage(){
 return JSON.parse(localStorage.getItem('storedCustomers')  || '""');
}

}
