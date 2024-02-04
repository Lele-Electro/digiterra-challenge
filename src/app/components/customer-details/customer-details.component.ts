import { Component, EventEmitter, Input, OnInit, Output, } from '@angular/core';
import { NgForm } from '@angular/forms';
import { details } from 'src/app/models/customer';

@Component({
  selector: 'app-customer-details',
  templateUrl: './customer-details.component.html',
  styleUrls: ['./customer-details.component.scss'],
})

export class CustomerDetailsComponent{
  @Input() customerDetails!: details;

}
