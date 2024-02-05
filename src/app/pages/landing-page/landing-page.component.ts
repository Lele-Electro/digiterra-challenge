import { LiveAnnouncer } from '@angular/cdk/a11y';
import { NgFor } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, OnInit,ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import {MatSort, Sort, MatSortModule} from '@angular/material/sort';
import {MatTableDataSource, MatTableModule} from '@angular/material/table';
import { Event, RouterEvent, Router, ActivatedRoute } from '@angular/router';
import { filter } from 'rxjs';
import { GenericSnackbarMessageComponent } from 'src/app/components/generic-snackbar-message/generic-snackbar-message.component';
import { address, comment, customer, customerPaths, details, id, physicalAddress, postalAddress, storedCustomer, } from 'src/app/models/customer';
import { NewCustomerService } from 'src/app/services/new-customer.service';



@Component({
  selector: 'app-landing-page',
  templateUrl: './landing-page.component.html',
  styleUrls: ['./landing-page.component.scss'],
})
export class LandingPageComponent implements OnInit, AfterViewInit {
  currentPath: customerPaths | string = 'customers';
  newCustomer!: customer;
  customers: storedCustomer[] = [];
  latestCustomerCount: number = 0;
  displayedColumns: string[] = ['name', 'surname', 'cellNumber', 'action'];
  dataSource = new MatTableDataSource(this.customers);
  customerIDPresent = false;
  detailsForm!: NgForm;
  addressForm!: NgForm;
  commentForm!: NgForm;

  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private router: Router,
    private cd: ChangeDetectorRef,
    private customerService: NewCustomerService,
    private _liveAnnouncer: LiveAnnouncer,
    private route: ActivatedRoute,
    private _snackBar: MatSnackBar
  ) {
    router.events
      .pipe(
        filter(
          (e: Event | RouterEvent): e is RouterEvent => e instanceof RouterEvent
        )
      )
      .subscribe((e: RouterEvent) => {
        this.currentPath = e.url;
      });
  }

  ngOnInit() {
    this.initializeCustomerObject();
    this.fetchCustomers();
    this.fetchIDFromURL();
    this.customerService.currentCount.subscribe((value) => {
      if (value > this.latestCustomerCount) {
        this.latestCustomerCount = value;
        this.customers = this.customerService.retrieveCustomersInLocalStorage();
        this.dataSource = new MatTableDataSource(this.customers);
        console.log(
          '%c DATA SOURCE',
          'background: goldenrod; padding: 20px; color:white; font-weight: 700'
        );
        console.log(this.dataSource);
      }
    });
  }

  ngAfterViewInit() {
    this.dataSource.sort = this.sort;
  }

  fetchCustomers() {
    this.customerService.getCustomers();
  }

  routeUserBackward() {
    return ['/customers/new/address'];
  }

  navigateToMoreDetailsPage(customer: storedCustomer) {
    this.currentPath =
      '/' + 'customers' + '/' + customer.firstName + customer.lastName;
    this.router.navigate(['/' + 'customers' + '/' + customer._id]);
  }

  formNavigateForward() {
    switch (this.currentPath) {
      case customerPaths.details:
        this.currentPath = customerPaths.address;
        this.router.navigate(['/' + customerPaths.address]);
        break;

      case customerPaths.address:
        this.currentPath = customerPaths.comments;
        this.router.navigate(['/' + customerPaths.comments]);
        break;

      case customerPaths.comments:
        this.currentPath = customerPaths.submit;
        this.router.navigate(['/' + customerPaths.comments]);

        break;

      default:
        break;
    }

    return [this.currentPath];
  }
  initializeCustomerObject() {
    let newCustomerDetails: details = {
      firstName: null,
      lastName: null,
      cellNumber: null,
    };

    let newcCustomerPhysicalAddress: physicalAddress = {
      lineOne: null,
      city: null,
      country: null,
      code: null,
    };

    let newcCustomerPostalAddress: postalAddress = {
      lineOne: null,
      city: null,
      country: null,
      code: null,
    };

    let addresses: address = {
      physicalAddress: newcCustomerPhysicalAddress,
      postalAddress: newcCustomerPostalAddress,
    };

    let customerID: id = {
      id: null,
    };
    let customerComment: comment = {
      comment: null,
    };
    this.newCustomer = {
      id: customerID,
      customerDetails: newCustomerDetails,
      customerAddress: addresses,
      customerComment: customerComment,
    };
  }
  formNavigateBackward() {
    switch (this.currentPath) {
      case customerPaths.submit:
        this.currentPath = customerPaths.comments;
        this.router.navigate(['/' + customerPaths.comments]);
        break;

      case customerPaths.comments:
        this.currentPath = customerPaths.address;
        this.router.navigate(['/' + customerPaths.address]);
        break;

      case customerPaths.address:
        this.currentPath = customerPaths.details;
        this.router.navigate(['/' + customerPaths.details]);
        break;

      case customerPaths.details:
        break;

      default:
        break;
    }
  }
  addCustomer() {
    // this.newCustomer.id.id = 'sdf'
    this.customerService
      .addcustomer(this.newCustomer)
      .subscribe((responseData) => {
        this.openSnackBar(3)
        this.router.navigate([customerPaths.allCustomers]);
      });
  }

  openSnackBar(seconds: number) {
    this._snackBar.openFromComponent(GenericSnackbarMessageComponent, {
      duration: seconds * 1000,
    });
  }



  checkIfFormPath() {
    if (
      this.currentPath === '/customers/new/details' ||
      this.currentPath === '/customers/new/address' ||
      this.currentPath === '/customers/new/comment'
    ) {
      return true;
    } else {
      return false;
    }
  }

  fetchIDFromURL() {
    this.route.paramMap.subscribe((params) => {
      let id = params.get('customerID');
      if (id === null) {
        this.customerIDPresent = false;
      } else {
        this.customerIDPresent = true;
      }
    });
  }

  updateDetailsFormStatus(form: NgForm) { this.detailsForm = form; }
  updateAddressFormStatus(form: NgForm) { this.addressForm = form; }
  updateCommentFormStatus(form: NgForm) { this.commentForm = form; }

  determineFormValidationStatus() {
    if ( this.detailsForm?.invalid || this.addressForm?.invalid || this.commentForm?.invalid ) {
      //if any of the forms are invalid then disable
      return true;
    } else {
      return false;
    }
  }

  announceSortChange(sortState: any) {
    if (sortState.direction) {
      this._liveAnnouncer.announce(`Sorted ${sortState.direction}ending`);
    } else {
      this._liveAnnouncer.announce('Sorting cleared');
    }
  }
}

