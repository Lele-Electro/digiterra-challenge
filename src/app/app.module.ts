import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LandingPageComponent } from './pages/landing-page/landing-page.component';
import { AllCustomersComponent } from './components/all-customers/all-customers.component';
import { CustomerDetailsComponent } from './components/customer-details/customer-details.component';
import { CustomerAddressComponent } from './components/customer-address/customer-address.component';
import { CustomerCommentsComponent } from './components/customer-comments/customer-comments.component';
import { HeaderComponentComponent } from './components/header-component/header-component.component';
import { FormsModule } from '@angular/forms';
import { HttpClientModule} from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations'
import { MatTableModule } from '@angular/material/table';
import { MoreDetailsComponent } from './components/more-details/more-details.component';
import {MatInputModule} from '@angular/material/input';
import {MatButtonModule} from '@angular/material/button';
import { FooterComponent } from './components/footer/footer.component';
import {MatSnackBarModule} from '@angular/material/snack-bar';
import { GenericSnackbarMessageComponent } from './components/generic-snackbar-message/generic-snackbar-message.component';
import {MatIconModule} from '@angular/material/icon';
import {MatDividerModule} from '@angular/material/divider';




@NgModule({
  declarations: [
    AppComponent,
    LandingPageComponent,
    AllCustomersComponent,
    CustomerDetailsComponent,
    CustomerAddressComponent,
    CustomerCommentsComponent,
    HeaderComponentComponent,
    MoreDetailsComponent,
    FooterComponent,
    GenericSnackbarMessageComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    HttpClientModule,
    BrowserAnimationsModule,
    MatTableModule,
    MatInputModule,
    MatButtonModule,
    MatSnackBarModule,
    MatIconModule,
    MatDividerModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
