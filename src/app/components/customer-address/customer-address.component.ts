import { AfterViewChecked, Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import {
  address,
  customer,
  physicalAddress,
  postalAddress,
} from 'src/app/models/customer';

@Component({
  selector: 'app-customer-address',
  templateUrl: './customer-address.component.html',
  styleUrls: ['./customer-address.component.scss'],
})
export class CustomerAddressComponent implements AfterViewChecked{

  @Input() addresses!: address;
  @Output() addressForm:EventEmitter<NgForm> = new EventEmitter<NgForm>
  @ViewChild('addressForm') addressFormRef!: NgForm

  outputFormToParentComponent(form:NgForm){
    this.addressForm.emit(form)
  }


  ngAfterViewChecked(): void {
    this.addressForm.emit(this.addressFormRef)
  }




}
