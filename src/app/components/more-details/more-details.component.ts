import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { storedCustomer } from 'src/app/models/customer';
import { NewCustomerService } from 'src/app/services/new-customer.service';

@Component({
  selector: 'app-more-details',
  templateUrl: './more-details.component.html',
  styleUrls: ['./more-details.component.scss']
})
export class MoreDetailsComponent implements OnInit {
  storedCustomers: storedCustomer[] = [];
  customerID!: string | null;
  selectedCustomer!: storedCustomer;


  constructor(
    private customerService: NewCustomerService,
    private route: ActivatedRoute
  ){}

  ngOnInit(): void {
   this.storedCustomers =  this.customerService.retrieveCustomersInLocalStorage();
   this.fetchIDFromURL();

  }

  fetchIDFromURL() {
    this.route.paramMap.subscribe((params) => {
      this.customerID = params.get('customerID');

      if(this.customerID !== null){
        this.findStoredCustomers()
      }

    });
  }

  findStoredCustomers(){
    let storedCustomerArray = this.storedCustomers.filter( customer => customer._id === this.customerID)
    if(storedCustomerArray.length > 0 ){
        this.selectedCustomer = storedCustomerArray[0]
    }

  }

}
