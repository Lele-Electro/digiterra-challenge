import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { customer, storedCustomer } from '../models/customer';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NewCustomerService {
  private customers: customer[] = [];
  private persistedCustomerCount = new BehaviorSubject<number>(0);
  currentCount = this.persistedCustomerCount.asObservable()

  constructor(
    private http: HttpClient
  ) { }

  updateCustomerCount(number: number){
    this.persistedCustomerCount.next(number)
  }

  getCustomers(){
    return this.http.get<{message: string, customers: storedCustomer[]}>('http://localhost:3000/api/customers')
    .subscribe( (customerData) => {
      this.storeCustomersInLocalStorage(customerData.customers);
      this.persistedCustomerCount.next(customerData.customers.length);

    })



  }

addcustomer(customer: customer){
 return this.http
.post<{message:string}>('http://localhost:3000/api/customers', customer);

}

storeCustomersInLocalStorage(storedcustomers: any[]){
  let serializedCustomerObjects = JSON.stringify(storedcustomers)
  localStorage.setItem('storedCustomers', serializedCustomerObjects)

}

retrieveCustomersInLocalStorage(){

 return JSON.parse(localStorage.getItem('storedCustomers')  || '""')

}

}
